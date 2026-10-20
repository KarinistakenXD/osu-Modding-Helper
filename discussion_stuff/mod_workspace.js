(() => {
    const editorSelector = '.beatmap-discussion-new__message-area, .beatmap-discussion-post__message--editor, [data-slate-editor="true"]';
    let profile = null, panel = null, view = 'mine', discussions = [], cursor = null, allLoaded = false, generation = 0, accountGeneration = 0, context = '';
    let checked = {}, seenMaps = {}, currentMap = [], currentMapLoaded = false, trackedMine = [];
    const draftStates = new Set();
    const editorStates = new WeakMap();
    const stateKey = () => `kmhReviewState:${profile?.id || 'guest'}`;
    const mapData = () => { try { return JSON.parse(document.getElementById('json-beatmapset')?.textContent || '{}'); } catch { return {}; } };
    const currentBeatmap = () => Number(location.pathname.match(/\/discussion\/(\d+)/)?.[1]) || Number(document.querySelector('.beatmap-list__item--current')?.dataset.id) || null;
    const textOf = editor => editor.tagName === 'TEXTAREA' ? editor.value : editor.innerText || editor.textContent || '';
    const setText = (editor, text) => { if (editor.tagName === 'TEXTAREA') Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(editor, text); else { editor.focus(); document.execCommand('insertText', false, text); } editor.dispatchEvent(new Event('input', { bubbles: true })); };
    const el = (tag, text, className) => { const node = document.createElement(tag); if (text != null) node.textContent = text; if (className) node.className = className; return node; };
    const button = (text, fn, className) => { const node = el('button', text, className); node.type = 'button'; node.onclick = fn; return node; };
    let overlay = null, returnFocus = null;
    const categories = new Set(['problem', 'suggestion', 'hype', 'praise', 'mapper_note']);
    let searchQuery = '', sortMode = 'updated', loadTarget = 50, dateFrom = '', dateTo = ''; 
    const discussionRoute = () => /^\/beatmapsets\/\d+\/discussion(?:\/|$)/.test(location.pathname);
    function closeWorkspace() { if (!overlay || overlay.hidden) return; overlay.hidden = true; document.body.style.overflow = overlay.kmhPreviousOverflow || ''; returnFocus?.focus(); }
    function openWorkspace(id, opener) { ensurePanel(); if (!overlay || !isModHelperFeatureEnabled('modWorkspace')) return; view = id; returnFocus = opener; if (overlay.hidden) overlay.kmhPreviousOverflow = document.body.style.overflow; overlay.hidden = false; document.body.style.overflow = 'hidden'; loadView(false); panel.querySelector('[data-close]').focus(); }
    const readActions = new Set(['getAuthStatus', 'fetchProfile', 'fetchDiscussions', 'fetchDiscussionPosts', 'fetchFavourites']);
    const request = (message, retried = false) => new Promise((resolve, reject) => {
        try { chrome.runtime.sendMessage(message, response => {
            const transport = chrome.runtime.lastError?.message;
            if (transport && !retried && readActions.has(message.action) && /message port closed|receiving end does not exist|message channel closed/i.test(transport)) {
                setTimeout(() => request(message, true).then(resolve, reject), 150); return;
            }
            if (transport) reject(new Error('Extension connection interrupted. Reload the extension and this osu! tab, then try Refresh.'));
            else if (response?.error) reject(new Error(response.error));
            else if (!response) reject(new Error('No response from the extension. Reload the extension and this osu! tab.'));
            else resolve(response.data);
        }); } catch { reject(new Error('Extension was updated or disconnected. Reload this osu! tab.')); }
    });
    const messageOf = discussion => discussion.starting_post?.message || discussion.posts?.[0]?.message || '(Discussion text unavailable)';
    const linkFor = d => `https://osu.ppy.sh/beatmapsets/${d.beatmapset_id}/discussion/${d.beatmap_id || '-'}/${d.timestamp != null ? 'timeline' : 'generalAll'}#/${d.id}`;
    function parseTimestamp(text) { const match = text.match(/(?:^|\s)(\d{1,3}):([0-5]\d):([0-9]{3})(?=\s|\b|$)/); return match ? (Number(match[1]) * 60 + Number(match[2])) * 1000 + Number(match[3]) : null; }
    function matchRelated(text, items, beatmapId) {
        const timestamp = parseTimestamp(text), words = new Set(text.toLowerCase().match(/[\p{L}\p{N}]{4,}/gu) || []);
        return items.filter(d => d.beatmap_id === beatmapId).map(d => {
            const nearby = timestamp != null && d.timestamp != null && Math.abs(d.timestamp - timestamp) <= 2000;
            const shared = [...new Set(messageOf(d).toLowerCase().match(/[\p{L}\p{N}]{4,}/gu) || [])].filter(w => words.has(w));
            return { discussion: d, score: (nearby ? 5 : 0) + shared.length, reason: nearby ? 'Within 2 seconds of this timestamp' : `${shared.length} shared keywords` };
        }).filter(result => result.score >= 3).sort((a, b) => b.score - a.score).slice(0, 5);
    }
    async function saveReviewState() { await chrome.storage.local.set({ [stateKey()]: { checked, seenMaps } }); }
    // osu! has no API field named 'needs recheck'. This is a local, opt-in-like
    // read checkpoint: first load sets baseline; later timestamp/state changes
    // become unread until the user opens the thread or its replies.
    const dateStamp = value => { const time=Date.parse(value || ''); return Number.isFinite(time) ? time : 0; };
    const currentActivityTime = discussion => discussion.last_post_at || discussion.updated_at || discussion.created_at || null;
    const activityKind = discussion => {
        const record = checked[discussion.id];
        if (!record || typeof record.wasResolved !== 'boolean') return null;
        if (record.wasResolved !== !!discussion.resolved) return discussion.resolved ? 'Resolved' : 'Reopened';
        return dateStamp(currentActivityTime(discussion)) > dateStamp(record.lastPostAt) ? 'New activity' : null;
    };
    async function baselineDiscussions(rows) {
        let changed=false;
        for (const item of rows) {
            if (!Object.hasOwn(checked, item.id) || typeof checked[item.id]?.wasResolved !== 'boolean') {
                checked[item.id]={...checked[item.id],lastPostAt:currentActivityTime(item),wasResolved:!!item.resolved};
                changed=true;
            }
        }
        if (changed) await saveReviewState();
    }
    function updateUnreadBadges(rows) {
        const n=rows.filter(item=>activityKind(item)).length;
        document.querySelectorAll('[data-kmh-open-finder]').forEach(entry=>{
            entry.dataset.unread=String(n);
            entry.title=n ? `My discussions · ${n} new activity updates (loaded results)` : 'My discussions';
            entry.setAttribute('aria-label',entry.title);
        });
        if(panel) {
            const label=panel.querySelector('[data-unread-tab]');
            if(label){label.textContent=n>0?String(n):'';label.hidden=!n;}
            const count=panel.querySelector('[data-unread-count]');
            if(count)count.textContent=String(n);
        }
    }
    async function markSeen(item) {
        checked[item.id]={...checked[item.id],lastPostAt:currentActivityTime(item),wasResolved:!!item.resolved};
        await saveReviewState();
        updateUnreadBadges(trackedMine);
        const row=panel?.querySelector(`[data-kmh-discussion-id="${item.id}"]`);
        row?.querySelectorAll('.kmh-unread-badge').forEach(node=>node.remove());
    }
    const typeStyles={
        problem: {label:'Problem',icon:'fas fa-exclamation-circle',color:'hsl(var(--hsl-red-3,0,65%,52%))'},
        suggestion:{label:'Suggestion',icon:'far fa-comment-alt',color:'hsl(var(--hsl-orange-3,32,76%,56%))'},
        hype:{label:'Hype',icon:'fas fa-bullhorn',color:'hsl(var(--hsl-blue-3,200,75%,52%))'},
        praise:{label:'Praise',icon:'fas fa-heart',color:'hsl(var(--hsl-blue-3,200,75%,52%))'},
        mapper_note:{label:'Mapper note',icon:'fas fa-sticky-note',color:'hsl(var(--hsl-purple-1,255,100%,70%))'}
    };
    const icon = name => el('i',null,name);
    const formattedDate=value=>dateStamp(value)?new Date(value).toLocaleDateString():'';
    const relativeDate = value => {
        const millis = dateStamp(value); if (!millis) return '';
        const elapsed = Math.max(0, Date.now()-millis);
        const units = [['year',31557600000],['month',2629800000],['day',86400000],['hour',3600000],['minute',60000]];
        const current = units.find(([, duration]) => elapsed >= duration);
        if(!current) return 'just now';
        const amount = Math.floor(elapsed/current[1]);
        return `${amount} ${current[0]}${amount===1?'':'s'} ago`;
    };
    const timestampRegex = /(?:^|[^\d:])(\d{2,3}:[0-5]\d:[0-9]{3})(?:\s*\(([-0-9|,\s]+)\))?/g;
    function timestampsFrom(text) {
        const found = [], unique = new Set();
        for(const match of String(text).matchAll(timestampRegex)) {
            const display=match[1];
            const target=display + (match[2] ? ` (${match[2].trim()})` : '');
            if(unique.has(target)) continue;
            unique.add(target); found.push({display,target});
            if(found.length===8)break;
        }
        return found;
    }
    function buildTimestamps(text) {
        const values = timestampsFrom(text); if(!values.length)return null;
        const box=el('div',null,'kmh-timestamp-block');
        const label=el('span',null,'kmh-timestamp-label');label.append(icon('far fa-clock'),document.createTextNode(' TIMESTAMPS'));
        box.append(label);
        for(const stamp of values){
            const chip=el('a',stamp.display,'kmh-timestamp-chip');
            chip.href=`osu://edit/${stamp.target}`;
            chip.title=`Open ${stamp.target} in the osu! editor (requires a locally installed osu! client)`;
            chip.setAttribute('aria-label',`Open timestamp ${stamp.target} in osu! editor`);
            const openIcon=icon('fas fa-external-link-alt');openIcon.setAttribute('aria-hidden','true');chip.append(openIcon);
            box.append(chip);
        }
        const copy=button('Copy',async()=>{
            try { await navigator.clipboard.writeText(values.map(v=>v.target).join(' '));copy.textContent='Copied!';setTimeout(()=>{if(copy.isConnected)copy.textContent='Copy';},1500); }
            catch {copy.textContent='Clipboard unavailable';}
        },'kmh-timestamp-copy');copy.title='Copy all displayed timestamps and note selections';box.append(copy);
        return box;
    }
    function appendFormattedText(root,text) {
        let isBold=false,isItalic=false;
        // Text nodes are always assigned using textContent. This is a limited
        // preview of Markdown + legacy BBCode, not a full HTML renderer.
        function appendInline(part){
            const pattern=/(\*\*[^*\n]+\*\*|\*[^*\n]+\*|\[[^\]\n]+\]\(https?:\/\/[^\s)]+\)|https?:\/\/[^\s<>]+)/g;
            let position=0;
            for(const match of part.matchAll(pattern)){
                if(match.index>position) appendSpan(part.slice(position,match.index));
                const token=match[0];
                if(token.startsWith('**'))appendSpan(token.slice(2,-2),true,false);
                else if(token.startsWith('*'))appendSpan(token.slice(1,-1),false,true);
                else {
                    const md=token.match(/^\[([^\]]+)\]\((https?:\/\/[^)]+)\)$/);
                    const href=md?.[2]||token, label=md?.[1]||token;
                    try {
                        const url=new URL(href);
                        if(url.protocol==='https:' || url.protocol==='http:'){
                            const a=el('a',label,'kmh-rich-link');a.href=url.href;a.target='_blank';a.rel='noopener noreferrer';a.title='Open external link';
                            a.append(icon('fas fa-external-link-alt kmh-link-arrow'));root.append(a);
                        } else appendSpan(token);
                    } catch {appendSpan(token);}
                }
                position=match.index+token.length;
            }
            if(position<part.length)appendSpan(part.slice(position));
        }
        function appendSpan(text,bold=false,italic=false){
            if(!text)return;
            const node=el('span',text.replace(/\[\/?(?:u|s|code)\]/gi,''));
            if(isBold||bold)node.style.fontWeight='700';
            if(isItalic||italic)node.style.fontStyle='italic';
            root.append(node);
        }
        for(const fragment of String(text).split(/(\[\/?(?:b|i)\])/gi)){
            if(/^\[b\]$/i.test(fragment)){isBold=true;continue;}
            if(/^\[\/b\]$/i.test(fragment)){isBold=false;continue;}
            if(/^\[i\]$/i.test(fragment)){isItalic=true;continue;}
            if(/^\[\/i\]$/i.test(fragment)){isItalic=false;continue;}
            appendInline(fragment);
        }
    }
    function fullPost(item) {
        const details=el('details',null,'kmh-post-details');
        details.append(el('summary','Read full post','kmh-detail-toggle'));
        const preview=el('div',null,'kmh-detail-preview');
        const raw=String(messageOf(item));
        const imagePattern=/(?:\[img\]([^\[\]\s]+)\[\/img\]|!\[[^\]]*\]\((https?:\/\/[^\s)]+)\))/gi;
        let last=0, match;
        while((match=imagePattern.exec(raw))!==null){
            if(match.index>last){const paragraph=el('p');appendFormattedText(paragraph,raw.slice(last,match.index));preview.append(paragraph);}
            try {
                const url=new URL(match[1] || match[2]);
                if(url.protocol==='https:' && ['http:','https:'].includes(url.protocol)) {
                    const img=el('img');img.loading='lazy';img.alt='Attached image';img.src=url.href;img.referrerPolicy='no-referrer';
                    preview.append(img);
                } else preview.append(el('span','[image]'));
            }catch{preview.append(el('span','[image]'));}
            last=imagePattern.lastIndex;
            if(last>50000)break;
        }
        if(last<raw.length){const paragraph=el('p');appendFormattedText(paragraph,raw.slice(last,last+15000));preview.append(paragraph);}
        details.append(preview);return details;
    }

    function postAttachmentImage(raw) {
        if(typeof raw!=='string')return null;
        const match=raw.match(/!\[[^\]]*\]\((https?:\/\/[^\s)]+)\)|\[img\](https?:\/\/[^\s\[]+)\[\/img\]|(https?:\/\/[^\s<>'"\])]+\.(?:png|jpe?g|gif|webp|avif)(?:\?[^\s]*)?)/i);
        const imageLike = match || raw.match(/(https?:\/\/(?:osu\.ppy\.sh\/ss\/\d+(?:\/[a-z0-9]+)?|(?:[^\s/]+\.)?s-ul\.eu\/[^\s<>'"\])]+))/i);
        if(!imageLike)return null;
        try {
            const u=new URL(match ? (match[1]||match[2]||match[3]) : imageLike[1]);
            return u.protocol==='https:'&&!u.username&&!u.password&&u.href.length<=2400?u.href:null;
        } catch{return null;}
    }
    function postAttachmentThumb(raw) {
        const url=postAttachmentImage(raw);if(!url)return null;
        const a=el('a',null,'kmh-post-attachment-thumb');a.href=url;a.target='_blank';a.rel='noopener noreferrer';a.title='Open attached image in new tab';a.setAttribute('aria-label','Open image attached to this discussion');
        const image=el('img');image.src=url;image.loading='lazy';image.referrerPolicy='no-referrer';image.alt='Attached modpost image';
        image.addEventListener('error',()=>a.remove(),{once:true});a.append(image);return a;
    }
    function accountUI() {
        const account = panel.querySelector('[data-account]'); account.replaceChildren();
        const accountStrip = panel.querySelector('.kmh-account-strip');
        accountStrip.classList.toggle('kmh-needs-auth', !profile);
        if (!profile) {
            const heading=el('strong','Connect osu! to unlock your modding workspace','kmh-onboarding-title');
            const details=el('div','Track your discussions and replies, see unresolved issues, and review favourite mapsets. Ranking Criteria and local drafts do not require sign-in.','kmh-onboarding-desc');
            const privacy=el('small','Requires public + identify access. This build uses the existing third-party token exchange proxy; connect only if you trust it.','kmh-onboarding-note');
            account.append(heading,details,privacy);
        } else {
            account.append(el('strong',`${profile.username} · osu! connected`,'kmh-account-welcome'));
            const groups = el('span', null, 'kmh-account-groups');
            const seen = new Set();
            for (const group of Array.isArray(profile.groups) ? profile.groups : []) {
                if (!group || group.identifier === 'default' || !group.name || seen.has(group.id ?? group.name)) continue;
                seen.add(group.id ?? group.name);
                const badge = el('span', group.name, 'kmh-account-group');
                for(const mode of Array.isArray(group.playmodes)?group.playmodes:[]){
                    if(!['osu','taiko','fruits','mania'].includes(mode))continue;
                    const symbol=icon(`fal fa-extra-mode-${mode}`);symbol.title=mode==='fruits'?'catch':mode;badge.append(symbol);
                }
                if (/^#[\da-f]{6}$/i.test(group.colour || '')) badge.style.borderColor = group.colour;
                groups.append(badge);
            }
            if (profile.is_supporter) groups.append(el('span', 'osu!supporter', 'kmh-account-group'));
            if (groups.childElementCount) account.append(groups);
        }
        const control=panel.querySelector('[data-connect]');
        control.textContent = profile ? 'Disconnect' : 'Connect osu! account ↗';
        control.classList.toggle('kmh-primary-button',!profile);
        control.classList.toggle('kmh-outline-button',!!profile);
    }
    async function connect() {
        const control = panel.querySelector('[data-connect]'); control.disabled = true;
        try { await request({ action: profile ? 'disconnectAuth' : 'startAuthFlow' }); window.dispatchEvent(new CustomEvent('mod-helper-osu-auth-changed')); }
        catch (error) { panel.querySelector('[data-results]').textContent = error.message; }
        finally { control.disabled = false; }
    }
    async function refreshAccount() {
        const turn = ++accountGeneration; await flushDrafts();
        try { const status = await request({ action: 'getAuthStatus' }); const nextProfile = status?.connected ? await request({ action: 'fetchProfile' }) : null; if (turn !== accountGeneration) return; profile = nextProfile;
            const state = (await chrome.storage.local.get([stateKey()]))[stateKey()] || {}; checked = state.checked || {}; seenMaps = state.seenMaps || {};
        } catch (error) { if (turn !== accountGeneration) return; profile = null; checked = {}; seenMaps = {}; panel.querySelector('[data-results]').textContent = `Account unavailable: ${error.message}`; }
        accountUI(); trackedMine = []; currentMap = []; currentMapLoaded = false; resetDraftContexts(); window.dispatchEvent(new Event('kmh-review-state-ready')); await loadView(false);
    }
    const shortMessage = discussion => String(messageOf(discussion))
        .replace(/!\[[^\]]*\]\([^)]*\)/g, '[image]')
        .replace(/\[([^\]]+)\]\(([^)]*)\)/g, '$1')
        .replace(/\[[^\]]+\]/g, '').replace(/\s+/g, ' ').trim();
    function drawRows(items) {
        const results = panel.querySelector('[data-results]'); results.replaceChildren();
        const filter = panel.querySelector('[data-filter]').value;
        const query = searchQuery.trim().toLocaleLowerCase();
        const filtered = items.filter(d => {
            if (!categories.has(d.message_type)) return false;
            if (view === 'followups' && (!['problem','suggestion'].includes(d.message_type) || (d.resolved && !activityKind(d)))) return false;
            if (filter === 'unresolved' && d.resolved || filter === 'resolved' && !d.resolved || filter === 'unread' && !activityKind(d)) return false;
            // Date filters are explicitly local to pages retrieved; the API does not expose a created-at range filter.
            const created=String(d.created_at||'').slice(0,10);
            if(dateFrom && (!created || created<dateFrom))return false;
            if(dateTo && (!created || created>dateTo))return false;
            if (!query) return true;
            const set = d.beatmapset || d.beatmap?.beatmapset || {};
            return [set.artist, set.title, d.beatmap?.version, d.message_type, messageOf(d), d.id, d.beatmapset_id].some(value => String(value ?? '').toLocaleLowerCase().includes(query));
        });
        const scoreDate = d => Date.parse(sortMode === 'created' ? d.created_at : d.last_post_at || d.updated_at || d.created_at) || 0;
        filtered.sort((a,b) => sortMode === 'oldest' ? scoreDate(a) - scoreDate(b) : scoreDate(b) - scoreDate(a));
        const unresolved = items.filter(d => !d.resolved).length;
        const recheck = items.filter(d => !!activityKind(d)).length;
        const counts = panel.querySelector('[data-counts]');
        if (counts) {
            counts.replaceChildren();
            for (const [value,label] of [[items.length,'Loaded discussions'],[unresolved,'Open discussions'],[recheck,'Unread activity']]) {
                const tile = el('div', null, 'kmh-summary-tile'); tile.append(el('strong', String(value)), el('span', label)); counts.append(tile);
            }
        }
        updateUnreadBadges(trackedMine);
        panel.querySelector('[data-coverage]').textContent = `${filtered.length} matching / ${items.length} retrieved · ${allLoaded ? 'No more API pages' : 'More history available'} · Date/search filters apply to retrieved pages only`;
        if (!filtered.length) {
            const empty = el('div', null, 'kmh-empty-state');
            empty.append(el('i', null, 'fas fa-search'), el('strong', items.length ? 'No matching discussions' : 'Nothing to show yet'), el('p', items.length ? 'Try changing the search, category or status filter.' : 'This section has no discussions in the loaded results.'));
            results.append(empty); return;
        }
        for (const d of filtered) {
            const row = el('article', null, 'kmh-mod-row kmh-mod-post-card');
            row.dataset.kmhDiscussionId = String(d.id);
            const set = d.beatmapset || d.beatmap?.beatmapset || {};
            const updated = currentActivityTime(d);
            const fresh = activityKind(d);
            const accent=typeStyles[d.message_type]||typeStyles.suggestion;
            row.style.setProperty('--kmh-discussion-accent',accent.color);
            const left=el('div',null,'kmh-post-left');
            const cover=set.covers?.list || set.covers?.card || null;
            if(typeof cover==='string' && /^https:\/\//i.test(cover)) {
                const img=el('img',null,'kmh-post-cover');img.src=cover;img.alt='Beatmap cover';img.loading='lazy';left.append(img);
            } else left.append(icon('fas fa-music kmh-mode-icon'));
            const body=el('div',null,'kmh-post-card-content');
            const head = el('div', null, 'kmh-mod-row-heading kmh-post-top');
            const status = el('span', d.resolved ? 'Resolved' : 'Open', `kmh-status-pill ${d.resolved ? 'is-resolved' : 'is-open'}`);
            const type = el('span',null,'kmh-type-pill');
            type.append(icon(accent.icon), document.createTextNode(accent.label));
            head.append(type,status);
            if(fresh)head.append(el('span',fresh,'kmh-unread-badge'));
            const date = updated || d.created_at;
            if (date && !Number.isNaN(Date.parse(date))) {const time = el('time', `${updated ? 'Updated ' : 'Posted '}${relativeDate(date)}`, 'kmh-row-date'); time.dateTime=date; time.title=`${updated?'Latest recorded activity':'Created'}: ${new Date(date).toLocaleString()}${d.created_at?' · Posted: '+new Date(d.created_at).toLocaleString():''}`; head.append(time);}
            const destination = el('div', null, 'kmh-mod-destination');
            const mapLink = el('a', `${set.artist ? set.artist + ' – ' : ''}${set.title || 'Mapset #' + d.beatmapset_id}`);
            mapLink.href = `https://osu.ppy.sh/beatmapsets/${d.beatmapset_id}`; mapLink.target = '_blank'; mapLink.rel = 'noopener noreferrer';mapLink.title='Open mapset on osu!web';mapLink.append(icon('fas fa-external-link-alt kmh-link-arrow'));
            const difficulty = el('span',null,'kmh-diff-label');
            const mode=d.beatmap?.mode || d.beatmapset?.beatmaps?.find(b=>b.id===d.beatmap_id)?.mode;
            if(mode && ['osu','mania','taiko','fruits'].includes(mode)) {
                const symbol=icon(`fal fa-extra-mode-${mode}`);symbol.title=mode==='fruits'?'catch':mode;
                difficulty.append(symbol,document.createTextNode(' '));
            }
            difficulty.append(document.createTextNode(d.beatmap_id ? (d.beatmap?.version || 'Difficulty #' + d.beatmap_id) : 'All difficulties'));
            destination.append(mapLink,difficulty);
            const message = el('a', shortMessage(d).slice(0,280) || 'Open discussion', 'kmh-discussion-excerpt');
            message.href=linkFor(d); message.target='_blank'; message.rel='noopener noreferrer'; message.title='Open this modpost on osu!web';
            const actions = el('div', null, 'kmh-mod-actions');
            const link = el('a', 'Open discussion ↗', 'kmh-thread-link'); link.href=linkFor(d);link.target='_blank';link.rel='noopener noreferrer';
            link.addEventListener('click',()=>{void markSeen(d);});
            const permalink=button('Copy link',async()=>{
                try{await navigator.clipboard.writeText(linkFor(d));permalink.textContent='Copied!';setTimeout(()=>{if(permalink.isConnected)permalink.textContent='Copy link';},1400);}
                catch{permalink.textContent='Copy unavailable';}
            },'kmh-small-action kmh-copy-permalink');
            permalink.title='Copy the direct osu!web discussion permalink';
            const repliesButton=button('View replies',async()=>{
                let thread=row.querySelector('.kmh-reply-preview');
                if(thread){thread.remove();repliesButton.setAttribute('aria-expanded','false');return;}
                thread=el('section',null,'kmh-reply-preview');thread.setAttribute('aria-label','Discussion thread replies');
                thread.append(el('p','Loading discussion posts…'));
                body.append(thread);repliesButton.disabled=true;repliesButton.setAttribute('aria-expanded','true');
                try{
                    const data=await request({action:'fetchDiscussionPosts',discussionId:d.id});
                    if(!thread.isConnected)return;
                    thread.replaceChildren();
                    const posts=Array.isArray(data?.posts)?data.posts:[];
                    const users=Array.isArray(data?.users)?data.users:[];
                    if(!posts.length)thread.append(el('p','No posts returned for this discussion.'));
                    for(const post of posts){
                        const author=users.find(user=>user.id===post.user_id)?.username||`User #${post.user_id||'?'}`;
                        const item=el('div',null,'kmh-reply-item');
                        const at=el('time',relativeDate(post.created_at),'kmh-row-date');if(dateStamp(post.created_at)){at.dateTime=post.created_at;at.title=new Date(post.created_at).toLocaleString();}
                        const caption=el('strong',`${author} · ${post.type||'reply'}`);
                        const content=el('p',String(post.message||'').replace(/\[img\].*?\[\/img\]/gis,'[image]').slice(0,750));
                        item.append(caption,at,content);thread.append(item);
                    }
                    if(data?.cursor_string)thread.append(el('small','Showing first page of thread posts. Open on osu! to see the complete thread.'));
                    await markSeen(d);
                }catch(error){if(thread.isConnected)thread.textContent=`Could not load replies: ${error.message}`;}
                finally{repliesButton.disabled=false;}
            },'kmh-small-action');
            repliesButton.setAttribute('aria-expanded','false');
            const expand=fullPost(d);
            actions.append(link,permalink,repliesButton);
            const timestamps=buildTimestamps(messageOf(d));
            const imageThumb=postAttachmentThumb([messageOf(d),...(Array.isArray(d.posts)?d.posts.map(p=>p?.message||''):[])].join('\n'));
            body.append(head,destination,message);
            if(timestamps)body.append(timestamps);
            if(imageThumb)body.append(imageThumb);
            body.append(expand,actions);
            row.append(left,body);results.append(row);
        }
    }
    async function loadView(more = false) {
        if (!panel) return;
        const turn=++generation, results=panel.querySelector('[data-results]'), load=panel.querySelector('[data-more]');
        panel.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===view)));
        panel.querySelector('[data-results-label]').textContent=({followups:'OPEN FOLLOW-UPS',mine:'MY DISCUSSIONS',map:'CURRENT MAPSET',favourites:'FAVOURITES',drafts:'DRAFT RECOVERY'})[view]||'DISCUSSION RESULTS';
        load.hidden=true;
        for(const key of ['filter','sort','search','date-from','date-to','load-target']) {
            const n=panel.querySelector(`[data-${key}]`);if(!n)continue;
            const hide=['favourites','drafts'].includes(view);
            (key==='search'?n.parentElement:key==='date-from'||key==='date-to'||key==='load-target'?n.closest('label'):n).hidden=hide;
        }
        panel.querySelector('[data-categories]').hidden=!['mine','followups'].includes(view);
        panel.querySelector('.kmh-review-checkpoint').hidden=view!=='map';
        if(view==='drafts') {cursor=null;allLoaded=true;discussions=[];panel.querySelector('[data-coverage]').textContent='';panel.querySelector('[data-counts]').replaceChildren();renderDrafts();return;}
        if(!profile) {discussions=[];cursor=null;panel.querySelector('[data-coverage]').textContent='';panel.querySelector('[data-counts]').replaceChildren();results.replaceChildren();const empty=el('div',null,'kmh-empty-state kmh-auth-empty');empty.append(el('i',null,'fas fa-lock'),el('strong','Connect your osu! account'),el('p','Authorize osu! to load your personal discussions and history. Local drafts and Ranking Criteria work without signing in.'));results.append(empty);return;}
        if(view==='favourites') {
            results.textContent='Loading favourites…';
            try {const response=await request({action:'fetchFavourites',page:1});if(turn!==generation)return;const sets=Array.isArray(response)?response:response?.beatmapsets||[];results.replaceChildren();panel.querySelector('[data-counts]').replaceChildren();if(!sets.length)results.append(el('p','No favourites returned.'));sets.forEach(set=>{const row=el('article',null,'kmh-mod-row kmh-favourite-row');const a=el('a',`${set.artist||''} — ${set.title||'Untitled mapset'}`,'kmh-favourite-link');a.href=`https://osu.ppy.sh/beatmapsets/${set.id}/discussion`;a.target='_blank';a.rel='noopener noreferrer';row.append(a,el('small','Open discussion page ↗'));results.append(row);});panel.querySelector('[data-coverage]').textContent='Favourites · first page';}catch(error){if(turn===generation)results.textContent=`Could not load favourites: ${error.message}`;}return;
        }
        const previous=more?discussions:[];
        let nextCursor=more?cursor:null;
        if(more && !nextCursor)return;
        let rows=previous.slice(), pages=0, lastCursor=nextCursor;
        const target=more?rows.length+50:loadTarget;
        const filters=['mine','followups'].includes(view)?{user:profile.id}:{beatmapset_id:mapData().id};
        const notice=el('p',null,'kmh-fetch-status');results.replaceChildren(notice);
        try {
            while(rows.length<target){
                notice.textContent=`Fetching discussion history… ${rows.length} retrieved`;
                const filter={...filters};if(nextCursor)filter.cursor_string=nextCursor;
                const data=await request({action:'fetchDiscussions',filters:filter});if(turn!==generation)return;
                const batch=(data?.discussions||[]).map(d=>({...d,beatmap:d.beatmap||data.beatmaps?.find(b=>b.id===d.beatmap_id),beatmapset:d.beatmapset||data.beatmapsets?.find(b=>b.id===d.beatmapset_id)||(d.beatmapset_id===mapData().id?mapData():null)}));
                rows=[...new Map([...rows,...batch].map(d=>[d.id,d])).values()];
                lastCursor=nextCursor;nextCursor=data?.cursor_string||null;pages++;
                if(!nextCursor||!batch.length||nextCursor===lastCursor)break;
                // Cap a single automatic run at 10 pages; further history requires clicking Load more.
                if(pages>=10)break;
            }
            discussions=rows;cursor=nextCursor;allLoaded=!cursor;
            await baselineDiscussions(rows);if(turn!==generation)return;
            if(view==='mine'||view==='followups')trackedMine=rows;
            if(view==='map'){currentMap=rows;currentMapLoaded=true;updateRelatedEditors();}
            drawRows(rows);load.hidden=!cursor;
        } catch(error){if(turn!==generation)return;discussions=rows;drawRows(rows);results.prepend(el('p',`History loading stopped: ${error.message}. Already retrieved pages remain available.`,'kmh-fetch-error'));load.hidden=!nextCursor;cursor=nextCursor;}
    }
    async function loadRelatedMap() {
        if (!profile || currentMapLoaded) return;
        const set = mapData().id, account = profile.id; const data = await request({ action: 'fetchDiscussions', filters: { beatmapset_id: set } });
        if (set !== mapData().id || account !== profile?.id) return; currentMap = data?.discussions || []; currentMapLoaded = true; updateRelatedEditors();
    }
    // Duplicate checking is a deliberate on-demand action from Drafts; no UI under osu!'s editor.
    function relatedMatches(state) { return matchRelated(textOf(state.editor), currentMap, currentBeatmap()); }
    const updateRelatedEditors = () => { if (view === 'drafts' && panel && !overlay?.hidden) renderDrafts(); };
    function draftKey(editor) {
        const thread = editor.closest('[data-discussion-id], .js-beatmap-discussion-jump[data-id], .beatmap-discussion[id]');
        const target = editor.classList.contains('beatmap-discussion-new__message-area') ? 'new' : `reply:${thread?.dataset.discussionId || thread?.dataset.id || thread?.id || editor.closest('.beatmap-discussion')?.querySelector('a[href*="#/"]')?.href || 'unidentified'}`;
        return `kmhDraft:${profile?.id || 'guest'}:${mapData().id}:${currentBeatmap() || 'all'}:${target}`;
    }
    async function recoverDraft(state) {
        const key = draftKey(state.editor); state.key = key; state.dirty = false;
        const saved = (await chrome.storage.local.get([key]))[key]; if (state.key !== key) return;
        state.saved = saved?.text || '';
        if (view === 'drafts' && panel && !overlay?.hidden) renderDrafts();
    }
    async function saveDraft(state) {
        if (!state.dirty || !isModHelperFeatureEnabled('draftRecovery')) return;
        state.dirty = false; const content = textOf(state.editor); const key = state.key;
        if (content.length > 500000) return;
        try {
            if (content.trim()) await chrome.storage.local.set({ [key]: { text:content, updatedAt: new Date().toISOString() } });
            else await chrome.storage.local.remove([key]);
            if (key === state.key && textOf(state.editor) === content) state.saved = content;
        } catch { state.dirty = true; }
    }
    async function flushDrafts() { await Promise.all([...draftStates].map(saveDraft)); }
    function resetDraftContexts() {
        // Never clear the user's editor just because osu! re-rendered or navigated.
        draftStates.forEach(state => { if (state.editor.isConnected) recoverDraft(state).catch(() => {}); });
    }
    function attachEditor(editor) {
        const existing = editorStates.get(editor);
        if (existing) { draftStates.add(existing); return; }
        const state = { editor, dirty:false, key:draftKey(editor), saved:'' };
        editorStates.set(editor,state); draftStates.add(state);
        recoverDraft(state).catch(() => {});
        let timer;
        editor.addEventListener('input', () => {
            state.dirty = true; clearTimeout(timer);
            timer = setTimeout(() => saveDraft(state), 450);
        });
        editor.addEventListener('blur', () => saveDraft(state));
    }
    async function renderDrafts() {
        if (!panel || view !== 'drafts') return;
        const target = panel.querySelector('[data-results]'); target.replaceChildren();
        const states = [...draftStates].filter(state => state.editor.isConnected);
        if (!states.length) { target.append(el('div', 'No editable discussion is currently available.', 'kmh-empty-state')); return; }
        for (const state of states) {
            const key = draftKey(state.editor);
            if (state.key !== key) await recoverDraft(state);
            const stored = (await chrome.storage.local.get([key]))[key];
            if (view !== 'drafts' || !target.isConnected) return;
            const row=el('article',null,'kmh-mod-row kmh-draft-card');
            const title=el('strong',state.editor.classList.contains('beatmap-discussion-new__message-area') ? 'New discussion' : 'Discussion reply','kmh-draft-title');
            const note=el('p',stored?.text ? `Saved locally · ${new Date(stored.updatedAt).toLocaleString()}` : 'No saved draft for this editor.','kmh-draft-note');
            const preview=el('p',String(stored?.text || '').slice(0,170),'kmh-discussion-excerpt');
            const actions=el('div',null,'kmh-mod-actions');
            const restore=button('Restore draft',()=>{
                const current=textOf(state.editor);
                if (current.trim() && !confirm('Append the saved draft to the current editor without replacing existing text?')) return;
                setText(state.editor, current.trim() ? `${current}\n\n${stored.text}` : stored.text);
                closeWorkspace();state.editor.focus();
            },'kmh-small-action');
            restore.disabled=!stored?.text || stored.text===textOf(state.editor);
            const related=button('Find related discussions',async()=>{
                related.disabled=true;
                try {
                    await loadRelatedMap();
                    const matches=relatedMatches(state);
                    const list=el('div',null,'kmh-related-results');
                    if (!matches.length) list.append(el('small','No strong matches in the loaded current-mapset discussions.'));
                    for(const result of matches){const a=el('a',messageOf(result.discussion).slice(0,105));a.href=linkFor(result.discussion);a.target='_blank';a.rel='noopener noreferrer';list.append(a,el('small',result.reason));}
                    row.querySelector('.kmh-related-results')?.remove();row.append(list);
                } catch(e) {row.querySelector('.kmh-related-results')?.remove();row.append(el('div',e.message,'kmh-related-results'));}
                finally{related.disabled=false;}
            },'kmh-small-action');
            related.disabled=!profile;
            actions.append(restore,related);row.append(title,note,preview,actions);target.append(row);
        }
    }
    function ensurePanel() {
        if (panel?.isConnected && overlay?.isConnected) return;
        if (overlay) { closeWorkspace(); overlay.remove(); }
        // Entry buttons are injected directly into osu!'s New Discussion heading.
        if (!document.querySelector('.beatmap-discussion-new')) return;
        panel=el('section',null,'kmh-mod-workspace');panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-labelledby','kmh-finder-title');
        const hero=el('header',null,'kmh-workspace-hero');
        const heroText=el('div',null,'kmh-hero-copy');
        heroText.append(el('span','MODDING / DISCUSSIONS','kmh-eyebrow'));
        const title=el('h2','My discussions');title.id='kmh-finder-title';heroText.append(title,el('p','Review discussions you started, identify new activity and revisit mapsets.'));
        const close=button('×',closeWorkspace,'kmh-icon-button');close.dataset.close='';close.setAttribute('aria-label','Close mod finder');
        const helperActions=el('div',null,'kmh-workspace-hero-tools');
        helperActions.append(button('Draft Coach',()=>{closeWorkspace();window.KmhDraftCoach?.open?.();},'kmh-outline-button'),button('⚙ Settings',()=>{closeWorkspace();window.KmhOpenSettings?.();},'kmh-outline-button'),close);
        hero.append(heroText,helperActions);
        const accountStrip=el('div',null,'kmh-account-strip');const account=el('div');account.dataset.account='';
        const connectButton=button('Connect osu! account ↗',connect,'kmh-primary-button');connectButton.dataset.connect='';accountStrip.append(account,connectButton);
        const layout=el('div',null,'kmh-workspace-layout');const sidebar=el('nav',null,'kmh-workspace-sidebar');sidebar.setAttribute('aria-label','Mod finder views');
        sidebar.append(el('div','BROWSE','kmh-sidebar-title'));
        for(const [id,label,icon] of [['followups','Open follow-ups','fas fa-inbox'],['mine','My discussions','fas fa-comments'],['map','Current mapset','fas fa-music'],['favourites','Favourites','fas fa-heart'],['drafts','Drafts & duplicates','fas fa-file-alt']]) {
            const tab=button(label,()=>{view=id;searchQuery=''; const field=panel.querySelector('[data-search]');if(field)field.value='';loadView(false);},'kmh-nav-tab');
            tab.dataset.view=id;const graphic=el('i',null,icon);tab.prepend(graphic);
            if(id==='followups'){const unread=el('span','', 'kmh-nav-unread');unread.dataset.unreadTab='';unread.hidden=true;tab.append(unread);}
            sidebar.append(tab);
        }
        const hint=el('div',null,'kmh-sidebar-hint');hint.append(el('strong','Unread activity'),el('p','Uses local checkpoints; not an official osu! notification feed. Visit a thread or open its replies to clear an activity marker.'));sidebar.append(hint);
        const main=el('main',null,'kmh-workspace-main');
        const mainHead=el('div',null,'kmh-list-header');const viewName=el('div','DISCUSSION RESULTS','kmh-eyebrow');viewName.dataset.resultsLabel='';mainHead.append(viewName);
        const refresh=button('↻ Refresh',()=>loadView(false),'kmh-outline-button');mainHead.append(refresh);
        const counts=el('div',null,'kmh-workspace-counts');counts.dataset.counts='';
        const controls=el('div',null,'kmh-workspace-controls');
        const search=el('input');search.type='search';search.placeholder='Search maps, difficulties or discussion text';search.dataset.search='';search.setAttribute('aria-label','Search loaded discussions');
        search.oninput=()=>{searchQuery=search.value; if(view==='favourites')return;drawRows(discussions);};
        const searchHolder=el('label',null,'kmh-search-wrap');searchHolder.append(el('i',null,'fas fa-search'),search);controls.append(searchHolder);
        const filter=el('select');filter.dataset.filter='';filter.setAttribute('aria-label','Discussion status');
        for(const [value,label] of [['all','All statuses'],['unresolved','Open only'],['resolved','Resolved only'],['unread','Unread activity']]) { const option=el('option',label);option.value=value;filter.append(option); }
        filter.onchange=()=>drawRows(discussions);controls.append(filter);
        const amountLabel=el('label',null,'kmh-history-control');amountLabel.append(el('span','Fetch','kmh-history-caption'));
        const amount=el('select');amount.dataset.loadTarget='';amount.setAttribute('aria-label','Discussions to retrieve');
        for(const n of [50,100,250,500]){const o=el('option',String(n));o.value=String(n);amount.append(o);}
        amount.value=String(loadTarget);amount.onchange=()=>{loadTarget=Number(amount.value)||50;loadView(false);};amountLabel.append(amount);controls.append(amountLabel);
        const dateControl=(labelName,key,handler)=>{const label=el('label',null,'kmh-history-control');label.append(el('span',labelName,'kmh-history-caption'));const input=el('input');input.type='date';input.dataset[key]='';input.setAttribute('aria-label',`${labelName} of discussion creation`);input.onchange=()=>{handler(input.value);drawRows(discussions);};label.append(input);controls.append(label);};
        dateControl('Posted from','dateFrom',v=>dateFrom=v);dateControl('Posted to','dateTo',v=>dateTo=v);
        const sort=el('select');sort.dataset.sort='';sort.setAttribute('aria-label','Sort discussions');
        for(const [value,label] of [['updated','Last updated'],['created','Newest first'],['oldest','Oldest first']]) {const option=el('option',label);option.value=value;sort.append(option);}
        sort.onchange=()=>{sortMode=sort.value;drawRows(discussions);};controls.append(sort);
        const types=el('fieldset',null,'kmh-mod-categories');types.dataset.categories='';
        types.append(el('legend','Discussion types'));
        for(const [value,label] of [['problem','Problem'],['suggestion','Suggestion'],['hype','Hype'],['praise','Praise'],['mapper_note','Mapper note']]) {
            const category=el('label',null,'kmh-category-toggle');category.dataset.type=value;
            category.style.setProperty('--kmh-discussion-accent',typeStyles[value].color);
            const input=el('input');input.type='checkbox';input.value=value;input.checked=categories.has(value);
            input.onchange=()=>{input.checked?categories.add(value):categories.delete(value);drawRows(discussions);};
            category.append(input,icon(typeStyles[value].icon),document.createTextNode(label));types.append(category);
        }
        const checkpoint=el('div',null,'kmh-review-checkpoint');
        const checkpointText=el('span');const checkpointButton=button('Mark reviewed',async()=>{
            seenMaps[mapData().id]={updated:mapData().last_updated||null,reviewedAt:new Date().toISOString()};await saveReviewState();renderCheckpoint();
        },'kmh-outline-button');
        function renderCheckpoint() {
            const saved=seenMaps[mapData().id],updated=mapData().last_updated;
            checkpointText.textContent=!saved?'No review checkpoint saved for this mapset.' :
                saved.updated && updated && saved.updated!==updated ? 'This mapset changed since your last review.' :
                `Last reviewed ${new Date(saved.reviewedAt).toLocaleDateString()}`;
        }
        checkpoint.append(el('i',null,'fas fa-clipboard-check'),checkpointText,checkpointButton);
        const coverage=el('small');coverage.dataset.coverage='';coverage.className='kmh-results-caption';
        const results=el('div');results.dataset.results='';results.className='kmh-workspace-results';
        const more=button('Load next 50 discussions',()=>loadView(true),'kmh-load-more');more.dataset.more='';more.hidden=true;
        const scroll=el('div',null,'kmh-workspace-scroll');scroll.append(checkpoint,coverage,results,more);
        main.append(mainHead,counts,controls,types,scroll);layout.append(sidebar,main);panel.append(hero,accountStrip,layout);
        overlay=el('div',null,'kmh-workspace-overlay');overlay.hidden=true;overlay.append(panel);
        overlay.onclick=event=>{if(event.target===overlay)closeWorkspace();};document.body.append(overlay);
        window.addEventListener('kmh-review-state-ready',renderCheckpoint);renderCheckpoint();
        refreshAccount().then(()=>window.dispatchEvent(new Event('kmh-review-state-ready')));
    }
    let lastActivityScan=0, checkingActivity=false;
    async function checkActivity() {
        if (checkingActivity || !profile || document.hidden || !discussionRoute() || !isModHelperFeatureEnabled('modWorkspace')) return;
        checkingActivity=true;
        try {
            const response=await request({action:'fetchDiscussions',filters:{user:profile.id}});
            const rows=(response?.discussions||[]);
            await baselineDiscussions(rows);
            trackedMine=rows;
            // Lightweight activity checks cover the newest 50; the full workspace can fetch more pages on demand.
            updateUnreadBadges(rows);
            if(overlay && !overlay.hidden && (view==='mine'||view==='followups'))await loadView(false);
        }catch(error){ console.debug('Modding Helper: activity check unavailable',error.message); }
        finally{lastActivityScan=Date.now();checkingActivity=false;}
    }
    setInterval(()=>{
        if(!profile || document.hidden || !discussionRoute())return;
        if(Date.now()-lastActivityScan < (overlay&&!overlay.hidden?120000:240000))return;
        void checkActivity();
    },30000);
    function scan() {
        if (!discussionRoute()) { closeWorkspace(); return; }
        if (isModHelperFeatureEnabled('modWorkspace')) ensurePanel(); else if (panel) panel.hidden = true;
        if (!isModHelperFeatureEnabled('modWorkspace')) closeWorkspace(); if (panel) panel.hidden = !isModHelperFeatureEnabled('modWorkspace');
        document.querySelectorAll(editorSelector).forEach(attachEditor);
        for (const state of draftStates) { if (!state.editor.isConnected) draftStates.delete(state); }
        const next = `${mapData().id}:${currentBeatmap()}`;
        if (context && context.split(':')[0] !== next.split(':')[0]) { currentMap = []; currentMapLoaded = false; if (profile && view === 'map') loadView(false); }
        if (context && context !== next) { flushDrafts().then(() => { resetDraftContexts(); updateRelatedEditors(); }); }
        context = next;
    }
    document.addEventListener('keydown', event => {
        if (!overlay || overlay.hidden) return;
        if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closeWorkspace(); }
        if (event.key === 'Tab') {
            const focusable = [...panel.querySelectorAll('button,a[href],select,input')].filter(n => !n.disabled && !n.closest('[hidden]'));
            const first = focusable[0], last = focusable.at(-1);
            if (!panel.contains(document.activeElement)) { event.preventDefault(); (event.shiftKey ? last : first)?.focus(); }
            else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
            else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
        }
    });
    window.KmhWorkspace = { scan, parseTimestamp, matchRelated, flushDrafts, loadView, open:openWorkspace, close:closeWorkspace, checkActivity };
    window.addEventListener('mod-helper-osu-auth-changed', () => { if (panel) refreshAccount(); });
    window.addEventListener('mod-helper-settings-changed', scan);
    document.addEventListener('visibilitychange', () => { if (document.hidden) flushDrafts(); });
    window.addEventListener('pagehide', flushDrafts);
    scan();
})();

