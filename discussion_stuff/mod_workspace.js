(() => {
    let accountAuthenticated = false, accountProblem = '', profile = null, panel = null, view = 'mine', discussions = [], cursor = null, allLoaded = false, generation = 0, accountGeneration = 0, context = '';
    let checked = {}, seenMaps = {}, trackedMine = [];
    const stateKey = () => `kmhReviewState:${profile?.id || 'guest'}`;
    const mapData = () => { try { return JSON.parse(document.getElementById('json-beatmapset')?.textContent || '{}'); } catch { return {}; } };
    const currentBeatmap = () => Number(location.pathname.match(/\/discussion\/(\d+)/)?.[1]) || Number(document.querySelector('.beatmap-list__item--current')?.dataset.id) || null;
    const textOf = editor => editor.tagName === 'TEXTAREA' ? editor.value : editor.innerText || editor.textContent || '';
    const el = (tag, text, className) => { const node = document.createElement(tag); if (text != null) node.textContent = text; if (className) node.className = className; return node; };
    const button = (text, fn, className) => { const node = el('button', text, className); node.type = 'button'; node.onclick = fn; return node; };
    let overlay = null, returnFocus = null;
    const categories = new Set(['problem', 'suggestion', 'hype', 'praise', 'mapper_note']);
    let searchQuery = '', sortMode = 'updated', loadTarget = 50, dateFrom = '', dateTo = ''; 
    const discussionRoute = () => /^\/beatmapsets\/\d+\/discussion(?:\/|$)/.test(location.pathname);
    function closeWorkspace() { if (!overlay || overlay.hidden) return; overlay.hidden = true; document.body.style.overflow = overlay.kmhPreviousOverflow || ''; returnFocus?.focus(); window.KmhSyncQuickToggles?.(); }
    function openWorkspace(id, opener) { if(['followups','map','favourites','drafts'].includes(id))id='mine';if(id==='staff')id='activity';ensurePanel(); if (!overlay || !isModHelperFeatureEnabled('modWorkspace')) return; view = id; returnFocus = opener; if (overlay.hidden) overlay.kmhPreviousOverflow = document.body.style.overflow; overlay.hidden = false; document.body.style.overflow = 'hidden'; loadView(false); panel.querySelector('[data-close]').focus(); window.KmhSyncQuickToggles?.(); }
    const readActions = new Set(['getAuthStatus', 'fetchProfile', 'fetchDiscussions', 'fetchDiscussionPosts', 'fetchFavourites', 'fetchKudosuHistory', 'fetchNominatedSets', 'fetchPublicUser', 'fetchBeatmapsetEvents', 'fetchBeatmapsetEventsForSet']);
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
    // Local read tracking, not osu!web's notification service. The discussion
    // list contains last_post_at but not last-post author. Verify new replies
    // with the posts endpoint before displaying an unread notification.
    const dateStamp = value => { const time=Date.parse(value || ''); return Number.isFinite(time) ? time : 0; };
    const currentActivityTime = discussion => discussion.last_post_at || discussion.updated_at || discussion.created_at || null;
    const activityKind = discussion => {
        const record = checked[discussion.id];
        if (!record || typeof record.wasResolved !== 'boolean') return null;
        if (record.manualUnread) return 'Unread';
        if (record.wasResolved !== !!discussion.resolved) return discussion.resolved ? 'Resolved' : 'Reopened';
        return record.pendingReplyAt && dateStamp(record.pendingReplyAt)>dateStamp(record.lastPostAt) ? 'New reply' : null;
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
    // Limit per-refresh post lookups. Do not replace an unknown author with a
    // fabricated notification. A transient API failure can be retried later.
    async function verifyExternalReplies(rows) {
        if (!profile?.id) return;
        const candidates=rows.filter(d=>{
            const record=checked[d.id];
            return record && record.wasResolved===!!d.resolved &&
              dateStamp(currentActivityTime(d))>dateStamp(record.lastPostAt) &&
              dateStamp(currentActivityTime(d))>dateStamp(record.verifiedAt);
        }).slice(0,12);
        let changed=false;let index=0;
        const worker=async()=>{
          while(index<candidates.length){
            const discussion=candidates[index++],record=checked[discussion.id];
            try {
              const data=await request({action:'fetchDiscussionPosts',discussionId:discussion.id});
              const posts=Array.isArray(data?.posts)?data.posts:[];
              // Incomplete pagination must not be used to infer that no one replied.
              if(!posts.length) continue;
              const newExternal=posts.filter(post=>
                !post.system && Number(post.user_id)!==Number(profile.id) &&
                dateStamp(post.created_at)>dateStamp(record.lastPostAt)
              ).sort((a,b)=>dateStamp(b.created_at)-dateStamp(a.created_at));
              if(!newExternal.length && data?.cursor_string) continue;
              const stamp=currentActivityTime(discussion);
              if(newExternal.length){
                record.pendingReplyAt=stamp;
              }else{
                record.lastPostAt=stamp;
                delete record.pendingReplyAt;
              }
              record.verifiedAt=stamp;changed=true;
            }catch{ /* No false unread from an unverified result. */ }
          }
        };
        await Promise.all(Array.from({length:Math.min(3,candidates.length)},worker));
        if(changed) await saveReviewState();
    }
    function updateUnreadBadges(rows) {
        const n=rows.filter(item=>activityKind(item)).length;
        document.querySelectorAll('[data-kmh-open-finder]').forEach(entry=>{
            entry.dataset.unread=String(n);
            entry.title=n ? `Recent Discussions · ${n} new follow-ups` : 'Recent Discussions';
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
        checked[item.id]={...checked[item.id],lastPostAt:currentActivityTime(item),verifiedAt:currentActivityTime(item),wasResolved:!!item.resolved,manualUnread:false};
        delete checked[item.id].pendingReplyAt;
        await saveReviewState();
        updateUnreadBadges(trackedMine);
        const row=panel?.querySelector(`[data-kmh-discussion-id="${item.id}"]`);
        row?.querySelectorAll('.kmh-unread-badge').forEach(node=>node.remove());
    }
    async function markUnread(item){
        checked[item.id]={...checked[item.id],manualUnread:true};
        await saveReviewState();updateUnreadBadges(trackedMine);
    }
    async function markAllRead(){
        if(!discussions.length)return;
        for(const item of discussions){
            checked[item.id]={...checked[item.id],lastPostAt:currentActivityTime(item),verifiedAt:currentActivityTime(item),wasResolved:!!item.resolved,manualUnread:false};
            delete checked[item.id].pendingReplyAt;
        }
        await saveReviewState();drawRows(discussions);
    }
    const typeStyles={
        problem: {label:'Problem',icon:'fas fa-exclamation-circle',color:'hsl(var(--hsl-red-3,0,65%,52%))'},
        suggestion:{label:'Suggestion',icon:'far fa-comment-alt',color:'hsl(var(--hsl-orange-3,32,76%,56%))'},
        hype:{label:'Hype',icon:'fas fa-bullhorn',color:'hsl(var(--hsl-blue-3,200,75%,52%))'},
        praise:{label:'Praise',icon:'fas fa-heart',color:'hsl(var(--hsl-blue-3,200,75%,52%))'},
        mapper_note:{label:'Note',icon:'fas fa-sticky-note',color:'hsl(var(--hsl-purple-1,255,100%,70%))'}
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

    function postAttachmentImages(raw) {
        if (typeof raw !== 'string' || !raw) return [];
        const out=[],used=new Set();
        // Scan long posts and all supported embed formats, not just the first
        // image. Hard cap prevents malicious posts from creating hundreds of DOM nodes.
        const regex=/!\[[^\]\n]{0,400}\]\((https?:\/\/[^\s)]+)\)|\[img\](https?:\/\/[^\s\[]+)\[\/img\]|(https?:\/\/[^\s<>"'`\])]+\.(?:png|jpe?g|gif|webp|avif)(?:\?[^\s<>"']*)?)|(https?:\/\/osu\.ppy\.sh\/ss\/\d+(?:\/[a-z0-9]+)?)|(https?:\/\/(?:[^\s/]+\.)?s-ul\.eu\/[^\s<>"'`\])]+)|<img[^>]{0,1000}?src=["'](https?:\/\/[^"']+)["']/gi;
        for(const m of raw.matchAll(regex)) {
            if(out.length>=24)break;
            try {
                const url=new URL(m[1]||m[2]||m[3]||m[4]||m[5]||m[6]);
                if(url.protocol!=='https:'||url.username||url.password||url.href.length>2400||used.has(url.href))continue;
                used.add(url.href);out.push(url.href);
            } catch {}
        }
        return out;
    }
    function postAttachmentGallery(raw) {
        const urls=postAttachmentImages(raw);if(!urls.length)return null;
        const gallery=el('div',null,'kmh-post-attachments');gallery.setAttribute('aria-label',`${urls.length} attached image links`);
        for(let i=0;i<urls.length;i++) {
            const url=urls[i],a=el('a',null,'kmh-post-attachment-thumb');a.href=url;a.target='_blank';a.rel='noopener noreferrer';a.title='Open original attached image';a.setAttribute('aria-label',`Open attached image ${i+1}`);
            if(i>=4)a.hidden=true;
            const img=el('img');img.src=url;img.loading=i<4?'eager':'lazy';img.referrerPolicy='no-referrer';img.alt='Discussion attachment';
            // Third-party hosts can refuse previewing. Keep the original link
            // as a visible fallback rather than silently removing the attachment.
            img.addEventListener('error',()=>{img.remove();a.textContent='Image ↗';a.classList.add('kmh-attachment-unavailable');},{once:true});
            a.append(img);gallery.append(a);
        }
        if(urls.length>4){const more=button(`+${urls.length-4} images`,()=>{
            const hidden=gallery.dataset.expanded!=='true';gallery.dataset.expanded=String(hidden);
            gallery.querySelectorAll('.kmh-post-attachment-thumb').forEach((n,i)=>n.hidden=i>=4&&!hidden);
            more.textContent=hidden?'Show fewer images':`+${urls.length-4} images`;
        },'kmh-more-attachments');gallery.append(more);}
        return gallery;
    }
    function imageUrl(value,allowedHosts) {
        if(typeof value!=='string')return null;
        try { const url=new URL(value);return url.protocol==='https:' && allowedHosts.has(url.hostname) ? url.href : null; }catch{return null;}
    }
    function accountUI() {
        const account=panel.querySelector('[data-account]');account.replaceChildren();
        const strip=panel.querySelector('.kmh-account-strip');
        const shell=panel.querySelector('.kmh-profile-shell');
        strip.classList.toggle('kmh-needs-auth',!accountAuthenticated);
        shell.classList.toggle('kmh-has-profile',!!profile);
        shell.style.removeProperty('--kmh-cover-image');
        const hosts=new Set(['assets.ppy.sh','osu.ppy.sh','a.ppy.sh']);
        if (!profile) {
            account.append(el('strong', accountAuthenticated ? 'osu! session connected' : 'Connect osu! to unlock your modding workspace','kmh-onboarding-title'),
              el('div', accountAuthenticated ? 'Your account is authorized, but profile data could not be loaded.' : 'Read your discussions and recent replies. Ranking Criteria works without connecting.','kmh-onboarding-desc'),
              el('small', accountProblem || (accountAuthenticated ? 'Use Refresh to retry the osu! API request.' : 'Authentication uses the configured third-party token exchange proxy. Connect only if you trust it.'),'kmh-onboarding-note'));
        } else {
            const cover=imageUrl(profile.cover?.url||profile.cover?.custom_url||profile.cover_url,hosts);
            if(cover)shell.style.setProperty('--kmh-cover-image',`url(${JSON.stringify(cover)})`);
            const avatar=imageUrl(profile.avatar_url,hosts);
            const identity=el('div',null,'kmh-profile-identity');
            if(avatar){const pic=el('img');pic.className='kmh-profile-avatar';pic.src=avatar;pic.alt='';pic.referrerPolicy='no-referrer';identity.append(pic);}
            const stack=el('div',null,'kmh-profile-info');
            const nameLine=el('div',null,'kmh-profile-name-line');
            const profileLink=el('a',String(profile.username||`User ${profile.id}`),'kmh-profile-name');
            if(Number.isSafeInteger(Number(profile.id))&&Number(profile.id)>0){profileLink.href=`https://osu.ppy.sh/users/${Number(profile.id)}`;profileLink.target='_blank';profileLink.rel='noopener noreferrer';}
            nameLine.append(profileLink);
            // Mirror osu!web's native support-level markup, not a fabricated one-heart text badge.
            if(profile.is_supporter === true){
                const hearts=Number(profile.support_level);
                const level=Number.isInteger(hearts)&&hearts>=1 ? Math.min(hearts,3) : 1;
                const icons=el('div',null,'profile-info__icons profile-info__icons--name-inline kmh-profile-icons');
                const supporter=el('a',null,'profile-info__icon profile-info__icon--supporter');
                supporter.href='https://osu.ppy.sh/home/support';
                supporter.title='osu!supporter';
                supporter.setAttribute('aria-label',`osu!supporter · ${level} heart${level===1?'':'s'}`);
                for(let i=0;i<level;i++){const heart=el('span',null,'fas fa-heart');heart.setAttribute('aria-hidden','true');supporter.append(heart);}
                icons.append(supporter);nameLine.append(icons);
            }
            const badges=el('span',null,'kmh-profile-badges');const groupApi=window.KmhGroupBadges;
            for(const group of (Array.isArray(profile.groups)?profile.groups:[]).filter(g=>groupApi?.eligible?.(g))){
                const badge=groupApi.make(group);if(badge)badges.append(badge);
            }
            if(badges.childElementCount)nameLine.append(badges);
            stack.append(nameLine);
            if(profile.title){const title=el('span',String(profile.title),'kmh-profile-user-title');if(/^#[a-f\d]{6}$/i.test(profile.profile_colour||''))title.style.color=profile.profile_colour;stack.append(title);}
            stack.append(el('span','osu! account connected','kmh-profile-status kmh111-connected'));
            identity.append(stack);account.append(identity);
        }
        const control=panel.querySelector('[data-connect]');
        control.classList.toggle('kmh111-connected',accountAuthenticated);
        control.classList.toggle('kmh111-disconnected',!accountAuthenticated);
        control.textContent=accountAuthenticated?'Disconnect':'Connect osu! ↗';
        control.classList.toggle('kmh-primary-button',!accountAuthenticated);
        control.classList.toggle('kmh-outline-button',accountAuthenticated);

    }
    async function connect() {
        if(accountAuthenticated && !confirm('Disconnect osu! from Modding Helper? Your local read markers will be kept.'))return;
        const control = panel.querySelector('[data-connect]'); control.disabled = true;
        try { await request({ action: accountAuthenticated ? 'disconnectAuth' : 'startAuthFlow' }); window.dispatchEvent(new CustomEvent('mod-helper-osu-auth-changed')); }
        catch (error) { panel.querySelector('[data-results]').textContent = error.message; }
        finally { control.disabled = false; }
    }
    async function refreshAccount() {
        const turn = ++accountGeneration;
        try {
            const status=await request({action:'getAuthStatus'});
            if(turn!==accountGeneration)return;
            accountAuthenticated=!!status?.connected;
            accountProblem='';
            if(accountAuthenticated){
                try { profile=await request({action:'fetchProfile'}); if(!profile?.id) throw new Error('Empty profile response'); }
                catch(error){ profile=null; accountProblem=`Profile unavailable: ${error.message}`; }
            } else profile=null;
            if(turn!==accountGeneration)return;
            const state=(await chrome.storage.local.get([stateKey()]))[stateKey()]||{};
            if(turn!==accountGeneration)return;
            checked=state.checked||{};seenMaps=state.seenMaps||{};
        } catch (error) {
            if(turn!==accountGeneration)return;
            // Communication failure is not a confirmed logout.
            accountProblem=`Connection check unavailable: ${error.message}`;
        }
        if(turn!==accountGeneration)return;
        accountUI(); trackedMine=[];if(view==='staff')view='activity';
        window.dispatchEvent(new Event('kmh-review-state-ready'));
        await loadView(false);
    }
    // Group membership gates read-only staff summaries; it is not authorization
    // for nomination, disqualification, moderation or any other write action.
    const isVerifiedStaff=user=>Array.isArray(user?.groups) && user.groups.some(group=>
        ['bng','bng_limited','nat','gmt','admin','dev','support','spt','lvd'].includes(String(group?.identifier||'').toLowerCase()));
    // Author data comes from the discussions bundle's `users` collection.
    // Never invent group badges or vote counts for fields the API omitted.
    const nativeAvatar = user => {
        try {
            const url = new URL(String(user?.avatar_url || ''));
            return url.protocol === 'https:' && ['a.ppy.sh', 'osu.ppy.sh', 'assets.ppy.sh'].includes(url.hostname) ? url.href : '';
        } catch { return ''; }
    };
    function nativeAuthorCard(user, fallbackId, mapperId = 0) {
        const card = el('div', null, 'kmh-native-author');
        const id = Number(user?.id || fallbackId);
        const href = Number.isSafeInteger(id) && id > 0 ? `https://osu.ppy.sh/users/${id}` : '';
        const photo = el(href ? 'a' : 'span', null, 'kmh-native-author-avatar');
        if (href) { photo.href = href; photo.target = '_blank'; photo.rel = 'noopener noreferrer'; }
        const image = nativeAvatar(user);
        if (image) {
            const img = el('img'); img.src = image; img.alt = ''; img.loading = 'lazy'; img.referrerPolicy = 'no-referrer'; photo.append(img);
        } else { const glyph=icon('fas fa-user');glyph.setAttribute('aria-hidden','true');photo.append(glyph); }
        const info = el('div', null, 'kmh-native-author-info');
        const name = el(href ? 'a' : 'strong', String(user?.username || (id ? `User #${id}` : 'Unknown user')), 'kmh-native-author-name');
        if (href) { name.href=href; name.target='_blank'; name.rel='noopener noreferrer'; }
        info.append(name);
        const badges = el('div', null, 'kmh-native-author-badges');
        if (mapperId && Number(mapperId) === id) badges.append(el('span', 'MAPPER', 'kmh-native-mapper-badge'));
        const badgeApi = window.KmhGroupBadges;
        for (const group of (Array.isArray(user?.groups) ? user.groups : [])) {
            if (!badgeApi?.eligible?.(group)) continue;
            const badge = badgeApi.make(group); if (badge) badges.append(badge);
        }
        if (badges.childElementCount) info.append(badges);
        card.append(photo, info); return card;
    }
    function nativeMessage(container, raw, maxLength = 1200) {
        const clean = String(raw || '')
            .replace(/!\[[^\]\n]*\]\(https?:\/\/[^)]+\)/gi, '')
            .replace(/\[img\]https?:\/\/[^\[]+\[\/img\]/gi, '')
            .trim();
        if (!clean) return;
        const content = el('div', null, 'kmh-native-post-message');
        appendFormattedText(content, clean.length > maxLength ? clean.slice(0, maxLength).trimEnd() + '…' : clean);
        container.append(content);
        if (clean.length <= maxLength) return;
        const toggle = button('Show full post', () => {
            const opened = toggle.getAttribute('aria-expanded') === 'true';
            content.replaceChildren(); appendFormattedText(content, opened ? clean.slice(0, maxLength).trimEnd() + '…' : clean);
            toggle.textContent = opened ? 'Show full post' : 'Show less';
            toggle.setAttribute('aria-expanded', String(!opened));
        }, 'kmh-native-expand');
        toggle.setAttribute('aria-expanded', 'false'); container.append(toggle);
    }
    function nativeExternalPreviews(raw) {
        const previewApi=window.KmhLinkPreview;
        if(typeof previewApi?.extract!=='function') return null;
        const items=previewApi.extract(String(raw||''))
            .filter(item=>item && item.type!=='image' && /^https?:\/\//i.test(item.href||''))
            .slice(0,4);
        if(!items.length)return null;
        const wrapper=el('div',null,'kmh-native-external-previews');
        wrapper.setAttribute('aria-label','Linked attachments');
        for(const item of items){
            const link=el('a',null,'kmh-native-external-tile');
            link.href=item.href;link.target='_blank';link.rel='noopener noreferrer';
            link.title=`Open ${item.label||item.host}`;
            if(typeof previewApi.createFavicon==='function')link.append(previewApi.createFavicon(item));
            else link.append(icon('fas fa-link'));
            const info=el('span',null,'kmh-native-external-copy');
            info.append(el('strong',String(item.label||item.host||'Attachment').slice(0,90)),
                        el('small',String(item.host||'').slice(0,70)));
            link.append(info);wrapper.append(link);
        }
        return wrapper;
    }
    // Retrieve recent replies only for visible cards; cache and deduplicate across renders.
    // osu!web's system post `message` is an object ({type:'resolved',value:boolean}),
    // NOT a user-written string. See upstream SystemPost and post JSON types.
    const threadCache = new Map();
    const threadQueue = [];
    let threadActive = 0;
    function threadSnapshot(discussionId, revision) {
        const id = Number(discussionId);
        if (!Number.isSafeInteger(id) || id <= 0) return Promise.reject(new Error('Invalid discussion'));
        if (threadCache.has(id)) {
            const entry=threadCache.get(id);
            if(entry.expires>Date.now() && entry.revision===String(revision||''))return entry.promise;
            threadCache.delete(id);
        }
        let resolve, reject;
        const promise = new Promise((yes,no)=>{resolve=yes;reject=no;});
        if (threadCache.size >= 100) threadCache.delete(threadCache.keys().next().value);
        threadCache.set(id,{promise,expires:Date.now()+60000,revision:String(revision||'')});
        threadQueue.push({id,resolve,reject});drainThreadQueue();
        return promise;
    }
    function drainThreadQueue() {
        while (threadActive < 2 && threadQueue.length) {
            const task = threadQueue.shift();threadActive++;
            request({action:'fetchDiscussionPosts',discussionId:task.id,sort:'id_desc',limit:50})
                .then(task.resolve,err=>{threadCache.delete(task.id);task.reject(err);})
                .finally(()=>{threadActive--;drainThreadQueue();});
        }
    }
    const postIsSystem = post => post?.system === true || post?.type === 'system' || (post?.message && typeof post.message === 'object' && post.message.type === 'resolved');
    const postIsReply = (post,discussion) => !postIsSystem(post) && (post?.type === 'reply' || (post?.type !== 'first' && Number(post?.id)!==Number(discussion?.starting_post?.id) && dateStamp(post?.created_at)>dateStamp(discussion?.created_at)));
    const safeUserName = (users, userId) => {
        const id=Number(userId);
        if (!Number.isSafeInteger(id) || id<=0) return '';
        return String(users.get(id)?.username || `User #${id}`);
    };
    const systemPostLabel = (post,users) => {
        const message=post?.message;
        if (!message || typeof message !== 'object' || message.type!=='resolved' || typeof message.value!=='boolean') return '';
        const action=message.value?'Marked as resolved':'Reopened';
        const username=safeUserName(users,post.user_id);
        return username?`${action} by ${username}`:action;
    };
    function setThreadSummary(slot, data, discussion) {
        if (!slot?.isConnected) return;
        slot.replaceChildren();
        const posts=Array.isArray(data?.posts)?data.posts:[];
        const users=new Map((Array.isArray(data?.users)?data.users:[]).map(u=>[Number(u.id),u]));
        const byTime=[...posts].sort((a,b)=>dateStamp(b.created_at)-dateStamp(a.created_at));
        const latestReply=byTime.find(p=>postIsReply(p,discussion));
        const latestResolution=byTime.find(p=>postIsSystem(p) && systemPostLabel(p,users));
        if (latestReply) {
            const name=safeUserName(users,latestReply.user_id);
            const label=el('span',name?`Latest reply by ${name}`:'Latest reply','kmh-thread-summary-line');
            const preview=String(latestReply.message||'').replace(/!\[[^\]]*\]\([^)]*\)/g,'[image]').trim().slice(0,105);
            if(preview)label.append(el('small',` · ${preview}`));
            slot.append(label);
        }
        if (latestResolution) slot.append(el('span',systemPostLabel(latestResolution,users),'kmh-thread-summary-line kmh-thread-summary-resolution'));
        slot.hidden=!slot.childElementCount;
    }
    let threadObserver = null, threadScheduled = 0;
    function wireVisibleThread(card, discussion, summary) {
        const load=()=>{if(threadScheduled>=30)return;threadScheduled++;
            void threadSnapshot(discussion.id,currentActivityTime(discussion)).then(data=>setThreadSummary(summary,data,discussion)).catch(()=>{});
        };
        if (typeof IntersectionObserver !== 'undefined') {
            if (!threadObserver) threadObserver=new IntersectionObserver(entries=>{
                for(const entry of entries)if(entry.isIntersecting){threadObserver.unobserve(entry.target);entry.target.__kmhLoadRecent?.();}
            },{root:panel?.querySelector('.kmh-workspace-scroll')||null,rootMargin:'100px 0px'});
            card.__kmhLoadRecent=load;threadObserver.observe(card);
        } else if(threadScheduled<6)load();
    }
    const shortMessage = discussion => String(messageOf(discussion))
        .replace(/!\[[^\]]*\]\([^)]*\)/g, '[image]')
        .replace(/\[([^\]]+)\]\(([^)]*)\)/g, '$1')
        .replace(/\[[^\]]+\]/g, '').replace(/\s+/g, ' ').trim();
    function drawRows(items) {
        if(threadObserver){threadObserver.disconnect();threadObserver=null;}
        threadScheduled=0;
        const results = panel.querySelector('[data-results]'); results.replaceChildren();
        const filter = panel.querySelector('[data-filter]').value;
        const query = searchQuery.trim().toLocaleLowerCase();
        const filtered = items.filter(d => {
            if (!categories.has(d.message_type)) return false;
            const resolvable = d.message_type === 'problem' || d.message_type === 'suggestion';
            if (filter === 'unresolved' && (!resolvable || d.resolved) || filter === 'resolved' && (!resolvable || !d.resolved) || filter === 'unread' && !activityKind(d)) return false;
            // Date filters are explicitly local to pages retrieved; the API does not expose a created-at range filter.
            const created=String(d.created_at||'').slice(0,10);
            if(dateFrom && (!created || created<dateFrom))return false;
            if(dateTo && (!created || created>dateTo))return false;
            if (!query) return true;
            const set = d.beatmapset || d.beatmap?.beatmapset || {};
            return [set.artist, set.title, d.beatmap?.version, d.message_type, messageOf(d), d.id, d.beatmapset_id].some(value => String(value ?? '').toLocaleLowerCase().includes(query));
        });
        const scoreDate = d => Date.parse(sortMode === 'created' ? d.created_at : d.last_post_at || d.updated_at || d.created_at) || 0;
        filtered.sort((a,b) => sortMode === 'oldest' ? scoreDate(a) - scoreDate(b) : sortMode==='updated' ? ((!!activityKind(b))-(!!activityKind(a))) || (scoreDate(b)-scoreDate(a)) : scoreDate(b)-scoreDate(a));
        const unresolved = items.filter(d => (d.message_type === 'problem' || d.message_type === 'suggestion') && !d.resolved).length;
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
        let unreadSeparatorShown=false,seenSeparatorShown=false;
        for (const d of filtered) {
            if(sortMode==='updated') {
                const unread=!!activityKind(d);
                if(unread && !unreadSeparatorShown){results.append(el('div','NEW UPDATES','kmh-unread-section-label'));unreadSeparatorShown=true;}
                if(!unread && unreadSeparatorShown && !seenSeparatorShown){results.append(el('div','PREVIOUSLY SEEN','kmh-seen-section-label'));seenSeparatorShown=true;}
            }
            const row = el('article', null, 'kmh-mod-row kmh-mod-post-card kmh-native-discussion');
            row.dataset.kmhDiscussionId = String(d.id);
            const set = d.beatmapset || d.beatmap?.beatmapset || {};
            const updated = currentActivityTime(d);
            const fresh = activityKind(d);
            const accent = typeStyles[d.message_type] || typeStyles.suggestion;
            row.style.setProperty('--kmh-discussion-accent', accent.color);
            const canResolve = d.message_type === 'problem' || d.message_type === 'suggestion';
            row.classList.add(canResolve ? (d.resolved ? 'kmh-thread-resolved' : 'kmh-thread-open') : 'kmh-thread-info');
            const rail=el('div',null,'kmh-native-event-rail');
            const eventIcon=icon(accent.icon);eventIcon.title=accent.label;eventIcon.setAttribute('aria-label',accent.label);rail.append(eventIcon);
            if(canResolve && d.resolved){
                const resolved=icon('far fa-check-circle kmh-native-resolved-icon');
                resolved.title='Resolved';resolved.setAttribute('aria-label','Resolved');rail.append(resolved);
            }
            const body=el('div',null,'kmh-post-card-content kmh-native-post-shell');
            const head=el('div',null,'kmh-mod-row-heading kmh-post-top kmh-native-heading');
            const mapLink=el('a',`${set.artist ? set.artist + ' – ' : ''}${set.title || 'Beatmapset #' + d.beatmapset_id}`,'kmh-native-beatmap-link');
            mapLink.href = `https://osu.ppy.sh/beatmapsets/${d.beatmapset_id}`;
            mapLink.target='_blank';mapLink.rel='noopener noreferrer';mapLink.title='Open beatmapset';
            const mapCover=el('a',null,'kmh-native-map-cover');mapCover.href=`https://osu.ppy.sh/beatmapsets/${d.beatmapset_id}`;
            mapCover.target='_blank';mapCover.rel='noopener noreferrer';mapCover.title='Open beatmapset';
            const cover=coverFor(set,d.beatmapset_id);
            if(cover){const image=el('img');image.src=cover;image.alt='';image.loading='lazy';image.referrerPolicy='no-referrer';
                image.onerror=()=>{image.remove();mapCover.classList.add('is-empty');};mapCover.append(image);}else mapCover.classList.add('is-empty');
            const type=el('span',null,'kmh-type-pill');type.append(icon(accent.icon),document.createTextNode(accent.label));
            head.append(mapCover,type,mapLink);
            if(canResolve){const status=el('span',d.resolved?'Resolved':'Open',`kmh-status-pill ${d.resolved?'is-resolved':'is-open'}`);head.append(status);}
            if(fresh)head.append(el('span',fresh,'kmh-unread-badge'));
            const date=updated||d.created_at;
            if(date&&dateStamp(date)){
                const time=el('time',`${updated?'Updated ':'Posted '}${relativeDate(date)}`,'kmh-row-date');
                time.dateTime=date;time.title=new Date(date).toLocaleString();head.append(time);
            }
            const mode=d.beatmap?.mode || set.beatmaps?.find(b=>Number(b.id)===Number(d.beatmap_id))?.mode;
            if(d.beatmap_id){const diff=el('span',null,'kmh-native-map-diff');
                if(mode && ['osu','taiko','fruits','mania'].includes(mode)) diff.append(icon(`fal fa-extra-mode-${mode}`));
                diff.append(document.createTextNode(d.beatmap?.version || 'Difficulty #' + d.beatmap_id));head.append(diff);
            }
            const main=el('div',null,'kmh-native-main');
            const user=d.author || d.user || d.starting_post?.user || null;
            const authorId=Number(d.starting_post?.user_id || d.user_id || user?.id || 0);
            const author=nativeAuthorCard(user,authorId,set.user_id);
            const article=el('div',null,'kmh-native-article');
            nativeMessage(article,messageOf(d));
            const imageThumb=postAttachmentGallery(messageOf(d));
            if(imageThumb){imageThumb.classList.add('kmh-native-image-attachments');article.append(imageThumb);}
            const external=nativeExternalPreviews(messageOf(d));if(external)article.append(external);
            const when=d.starting_post?.created_at || d.created_at;
            const postMeta=el('div',null,'kmh-native-post-meta');
            if(when && dateStamp(when)){
                const time=el('time',relativeDate(when));time.dateTime=when;time.title=new Date(when).toLocaleString();postMeta.append(time);
            }
            const permalink=button('permalink',async()=>{
                try{await navigator.clipboard.writeText(linkFor(d));permalink.textContent='copied';setTimeout(()=>{if(permalink.isConnected)permalink.textContent='permalink';},1400);}
                catch{permalink.textContent='copy unavailable';}
            },'kmh-native-meta-action');permalink.title='Copy direct discussion link';
            postMeta.append(permalink);
            article.append(postMeta);
            main.append(author,article);
            const threadSummary=el('div',null,'kmh-thread-summary');threadSummary.hidden=true;
            const repliesContainer=el('div',null,'kmh-reply-preview kmh-native-thread');repliesContainer.hidden=true;
            const footer=el('div',null,'kmh-mod-actions kmh-native-post-footer');
            const repliesButton=button('',async()=>{
                if(!repliesContainer.hidden){repliesContainer.hidden=true;repliesButton.setAttribute('aria-expanded','false');
                    repliesButton.querySelector('.btn-osu-big__text-top').textContent='View replies';return;}
                repliesContainer.hidden=false;repliesButton.setAttribute('aria-expanded','true');
                repliesButton.querySelector('.btn-osu-big__text-top').textContent='Hide replies';
                if(repliesContainer.dataset.loaded==='true')return;
                repliesContainer.replaceChildren(el('p','Loading replies…','kmh-native-loading'));
                repliesButton.disabled=true;
                try{
                    const data=await threadSnapshot(d.id,currentActivityTime(d));
                    if(!repliesContainer.isConnected)return;
                    repliesContainer.replaceChildren();setThreadSummary(threadSummary,data,d);
                    const posts=Array.isArray(data?.posts)?data.posts:[];
                    const users=new Map((Array.isArray(data?.users)?data.users:[]).map(u=>[Number(u.id),u]));
                    const replies=posts.filter(p=>postIsSystem(p)||postIsReply(p,d))
                        .sort((a,b)=>dateStamp(a.created_at)-dateStamp(b.created_at));
                    if(!replies.length)repliesContainer.append(el('p','No replies in the retrieved posts.','kmh-native-loading'));
                    for(const post of replies){
                        if(postIsSystem(post)){
                            const label=systemPostLabel(post,users);
                            if(!label)continue; // Do not stringify unknown system payloads.
                            const system=el('div',null,'kmh-native-system-event');
                            system.append(icon(post.message.value?'fas fa-check-circle':'fas fa-comment-alt'),el('span',label,'kmh-native-system-label'));
                            if(dateStamp(post.created_at)){
                                const time=el('time',relativeDate(post.created_at),'kmh-native-reply-date');
                                time.dateTime=post.created_at;system.append(time);
                            }
                            repliesContainer.append(system);continue;
                        }
                        const reply=el('div',null,'kmh-native-reply');
                        const replyAuthor=nativeAuthorCard(users.get(Number(post.user_id)),post.user_id,set.user_id);
                        const replyBody=el('div',null,'kmh-native-reply-content');
                        nativeMessage(replyBody,post.message,650);
                        const gallery=postAttachmentGallery(String(post.message||''));
                        if(gallery){gallery.classList.add('kmh-native-image-attachments');replyBody.append(gallery);}
                        const external=nativeExternalPreviews(post.message);if(external)replyBody.append(external);
                        if(post.created_at&&dateStamp(post.created_at)){
                            const t=el('time',relativeDate(post.created_at),'kmh-native-reply-date');t.dateTime=post.created_at;
                            t.title=new Date(post.created_at).toLocaleString();replyBody.append(t);
                        }
                        reply.append(replyAuthor,replyBody);repliesContainer.append(reply);
                    }
                    if(data?.cursor_string)repliesContainer.append(el('small','Showing the latest 50 posts. Open on osu!web for older replies.','kmh-native-loading'));
                    repliesContainer.dataset.loaded='true';await markSeen(d);
                }catch(error){if(repliesContainer.isConnected)repliesContainer.textContent=`Could not load replies: ${error.message}`;}
                finally{repliesButton.disabled=false;}
            },'btn-osu-big kmh-native-respond kmh-native-view-replies');
            const replyContent=el('span',null,'btn-osu-big__content');
            const replyLeft=el('span',null,'btn-osu-big__left');
            replyLeft.append(el('span','View replies','btn-osu-big__text-top'));
            replyContent.append(replyLeft,icon('fas fa-comments'));repliesButton.append(replyContent);
            repliesButton.title='Show replies and resolution history';repliesButton.setAttribute('aria-expanded','false');
            const readButton=button(fresh?'Mark read':'Mark unread',async()=>{
                if(activityKind(d))await markSeen(d);else await markUnread(d);
                drawRows(discussions);
            },'kmh-native-secondary-action kmh-mark-read-action');
            readButton.dataset.action=fresh?'read':'unread';
            readButton.title=fresh?'Acknowledge this update':'Flag for follow-up';
            footer.append(readButton,repliesButton);
            body.append(head,main,threadSummary,repliesContainer,footer);
            row.append(rail,body);results.append(row);
            wireVisibleThread(row,d,threadSummary);
        }
    }
    const safeSetLink = raw => {
        const id=Number(raw);
        return Number.isSafeInteger(id) && id>0 ? `https://osu.ppy.sh/beatmapsets/${id}` : '';
    };
    const prettyNumber = number => Number(number).toLocaleString('en-US');
    // The kudosu API returns only post.url/title, not an embedded beatmapset.
    // Beatmapset discussion post links use /beatmapsets/discussions/{discussionId},
    // which must NEVER be mistaken for /beatmapsets/{beatmapsetId}.
    const kudosuPostPath = raw => {
        try {
            const url = new URL(String(raw || ''), 'https://osu.ppy.sh');
            return url.protocol === 'https:' && url.hostname === 'osu.ppy.sh' && !url.username && !url.password ? url.pathname : '';
        } catch { return ''; }
    };
    const mapsetIdFromUrl = raw => {
        const match = kudosuPostPath(raw).match(/^\/beatmapsets\/(\d+)(?:\/|$)/);
        const id = Number(match?.[1]);
        return Number.isSafeInteger(id) && id > 0 ? id : null;
    };
    const discussionIdFromUrl = raw => {
        const path = kudosuPostPath(raw);
        const match = path.match(/^\/(?:beatmapsets\/discussions|beatmap-discussions)\/(\d+)(?:\/|$)/);
        const id = Number(match?.[1]);
        return Number.isSafeInteger(id) && id > 0 ? id : null;
    };
    // Lazy, bounded and deduplicated. The upstream API terms discourage
    // excessive polling; initial view resolves only five visible kudosu cards.
    const kudosuArtworkRequests = new Map();
    const kudosuArtworkQueue = [];
    let kudosuArtworkActive = 0;
    function drainKudosuArtworkQueue() {
        while (kudosuArtworkActive < 2 && kudosuArtworkQueue.length) {
            const { discussionId, resolve } = kudosuArtworkQueue.shift();
            kudosuArtworkActive++;
            request({action:'fetchDiscussionPosts',discussionId,limit:1}).then(data => {
                const discussions = Array.isArray(data?.discussions) ? data.discussions : [];
                const posts = Array.isArray(data?.posts) ? data.posts : [];
                const matching = discussions.find(d => Number(d.id) === discussionId);
                const belongs = matching || posts.some(post => Number(post.beatmap_discussion_id) === discussionId);
                if (!belongs) return '';
                const sets = Array.isArray(data?.beatmapsets) ? data.beatmapsets : [];
                const set = sets.find(item => Number(item.id) === Number(matching?.beatmapset_id)) || (sets.length === 1 ? sets[0] : null);
                return set ? coverFor(set, set.id) : '';
            }).catch(() => '').then(resolve).finally(() => { kudosuArtworkActive--;drainKudosuArtworkQueue(); });
        }
    }
    function kudosuArtworkForDiscussion(discussionId) {
        if (!kudosuArtworkRequests.has(discussionId)) {
            const result = new Promise(resolve => {
                kudosuArtworkQueue.push({ discussionId, resolve });
                drainKudosuArtworkQueue();
            }).then(url => {
                // A missing/deleted discussion or transient API failure must
                // not be cached as permanently blank artwork.
                if (!url) kudosuArtworkRequests.delete(discussionId);
                return url;
            });
            if (kudosuArtworkRequests.size >= 80) kudosuArtworkRequests.delete(kudosuArtworkRequests.keys().next().value);
            kudosuArtworkRequests.set(discussionId,result);
        }
        return kudosuArtworkRequests.get(discussionId);
    }
    function showKudosuArtwork(row, coverUrl) {
        if (!row.isConnected || !/^https:\/\//i.test(coverUrl)) return;
        const thumb = row.querySelector('.kmh-event-cover');
        if (!thumb) return;
        const image = el('img');
        image.alt = 'Beatmap cover';
        image.loading = 'lazy';
        image.referrerPolicy = 'no-referrer';
        image.onerror = () => { image.remove();thumb.classList.add('kmh-event-cover-empty'); };
        image.src = coverUrl;
        thumb.replaceChildren(image);
        thumb.classList.remove('kmh-event-cover-empty');
    };    const coverFor = (set,id) => {
        const candidate=String(set?.covers?.list||set?.covers?.card||'');
        if(/^https:\/\/(?:assets\.ppy\.sh|osu\.ppy\.sh)\//.test(candidate))return candidate;
        const number=Number(id);
        return Number.isSafeInteger(number)&&number>0?`https://assets.ppy.sh/beatmaps/${number}/covers/list.jpg`:'';
    };
    function eventListItem(title,sub,when,href,cover='',tone='neutral',annotation='',eventIcon=''){
        const row=el('article',null,'kmh-event-row kmh-event-card');
        row.dataset.tone=tone;
        const thumb=el('span',null,'kmh-event-cover');
        if(/^https:\/\//.test(cover)){
            const img=el('img');img.src=cover;img.alt='';img.loading='lazy';img.referrerPolicy='no-referrer';
            img.onerror=()=>{img.remove();thumb.classList.add('kmh-event-cover-empty');};thumb.append(img);
        }else thumb.classList.add('kmh-event-cover-empty');
        const main=el('div',null,'kmh-event-row-main');main.append(el('strong',title));
        if(sub){
            if(href){const link=el('a',sub);link.href=href;link.target='_blank';link.rel='noopener noreferrer';main.append(link);}
            else main.append(el('span',sub));
        }
        if(annotation)main.append(el('small',annotation,'kmh-event-context'));
        if(when&&dateStamp(when)){
            const time=el('time',new Date(when).toLocaleString(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}),'kmh-event-date');
            time.dateTime=when;time.title=new Date(when).toLocaleString();main.append(time);
        }
        const stripe=el('span',null,'kmh-event-accent');stripe.setAttribute('aria-hidden','true');
        row.append(thumb,stripe);
        if(eventIcon){const glyph=el('span',null,'kmh-event-symbol');const symbol=/(?:^|\s)fa-thumbs-down(?:\s|$)/.test(eventIcon) ? thumbsDownIcon() : icon(eventIcon);symbol.setAttribute('aria-hidden','true');glyph.append(symbol);row.append(glyph);}
        row.append(main);
        return row;
    }
    // osu!web can override Font Awesome glyphs. Render a deterministic
    // thumbs-down silhouette for disqualifications and lost kudosu instead.
    function thumbsDownIcon() {
        const ns='http://www.w3.org/2000/svg';
        const svg=document.createElementNS(ns,'svg');
        svg.setAttribute('class','kmh-thumbs-down-svg');
        svg.setAttribute('width','19');svg.setAttribute('height','19');
        svg.setAttribute('viewBox','0 0 24 24');
        svg.setAttribute('fill','currentColor');
        svg.setAttribute('aria-hidden','true');
        // A filled thumbs-up turned through 180 degrees yields an unmistakable
        // downwards thumb. No font lookup or pseudo-element mapping involved.
        const group=document.createElementNS(ns,'g');
        group.setAttribute('transform','rotate(180 12 12)');
        const path=document.createElementNS(ns,'path');
        path.setAttribute('d','M1 21h4V9H1v12z M23 10c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z');
        group.append(path);svg.append(group);
        return svg;
    }
    function section(results,title,description,extra=''){
        const box=el('section',null,`kmh-activity-section ${extra}`.trim());
        const head=el('div',null,'kmh-activity-head');head.append(el('h3',title));
        box.append(head);
        if(description)box.append(el('p',description,'kmh-activity-hint'));
        results.append(box);return box;
    }
    function listWithShowMore(parent,items,limit=5,onExpand=null){
        if(!items.length)return;
        const holder=el('div',null,'kmh-activity-list');holder.append(...items.slice(0,limit));
        parent.append(holder);
        if(items.length>limit){
            const more=button(`Show ${items.length-limit} more`,()=>{
                const expanded=more.getAttribute('aria-expanded')==='true';
                holder.replaceChildren(...(expanded?items.slice(0,limit):items));
                if (!expanded) onExpand?.();
                more.textContent=expanded?`Show ${items.length-limit} more`:'Show less';
                more.setAttribute('aria-expanded',String(!expanded));
            },'kmh-show-more');more.setAttribute('aria-expanded','false');parent.append(more);
        }
    }
    const eventCollection = data => Array.isArray(data) ? data : Array.isArray(data?.events) ? data.events : [];
    // Match osu!web's beatmapset-event palette. A red reset is not a disqualification:
    // separate labels/icons preserve the meaning even when both have a red stripe.
    const eventPresentation = {
        issue_resolve:          {label:'Resolved',icon:'fas fa-check-circle',tone:'resolved'},
        issue_reopen:           {label:'Reopened',icon:'fas fa-comment-alt',tone:'reopen'},
        nominate:              {label:'Nominated',icon:'fas fa-thumbs-up',tone:'nomination'},
        nomination_reset:      {label:'Nomination reset',icon:'fas fa-undo-alt',tone:'danger'},
        nomination_reset_received:{label:'Nominations reset',icon:'fas fa-history',tone:'danger'},
        qualify:               {label:'Qualified',icon:'fas fa-check-double',tone:'nomination'},
        disqualify:            {label:'Disqualified',icon:'fas fa-thumbs-down',tone:'danger'},
        rank:                  {label:'Ranked',icon:'fas fa-trophy',tone:'positive'},
        love:                  {label:'Loved',icon:'fas fa-heart',tone:'love'},
        remove_from_loved:     {label:'Removed from Loved',icon:'fas fa-heart-broken',tone:'danger'},
        genre_edit:            {label:'Genre updated',icon:'fas fa-music',tone:'info'},
        language_edit:         {label:'Language updated',icon:'fas fa-language',tone:'info'},
        nsfw_toggle:           {label:'NSFW status updated',icon:'fas fa-eye-slash',tone:'info'},
        offset_edit:           {label:'Offset updated',icon:'fas fa-clock',tone:'info'},
        tags_edit:             {label:'Tags updated',icon:'fas fa-tags',tone:'info'},
        beatmap_owner_change:  {label:'Ownership updated',icon:'fas fa-user-friends',tone:'info'},
        discussion_lock:       {label:'Discussion locked',icon:'fas fa-lock',tone:'danger'},
        discussion_unlock:     {label:'Discussion unlocked',icon:'fas fa-unlock',tone:'resolved'},
        discussion_delete:     {label:'Discussion removed',icon:'fas fa-trash-alt',tone:'reopen'},
        discussion_restore:    {label:'Discussion restored',icon:'fas fa-undo',tone:'info'},
        discussion_post_delete:{label:'Post removed',icon:'fas fa-trash',tone:'reopen'},
        discussion_post_restore:{label:'Post restored',icon:'fas fa-undo',tone:'info'},
        approve:               {label:'Approved',icon:'fas fa-check',tone:'nomination'}
    };
    const moddingEvent = event => {
        const type=String(event?.type||'');
        return Object.hasOwn(eventPresentation,type) && !type.startsWith('kudosu_');
    };
    function renderModdingEvents(parent,data,id){
        const box=section(parent,'Recent Events','', 'kmh-modding-events-panel');
        const raw=eventCollection(data);
        const names=new Map((Array.isArray(data?.users)?data.users:[]).map(u=>[Number(u.id),String(u.username||'')]));
        let entries=raw.filter(moddingEvent).slice(0,40);
        // osu! emits both a nomination reset and a disqualification for some
        // actions. Fold only contemporaneous records for the SAME beatmapset,
        // retaining the explicit disqualification. Independent resets remain.
        const eventSetId=e=>Number(e?.beatmapset_id||e?.beatmapset?.id)||0;
        const sameDisqualification=(reset,dq)=>{
            const setId=eventSetId(reset);
            return setId>0 && setId===eventSetId(dq) &&
                dateStamp(reset.created_at)>0 && dateStamp(dq.created_at)>0 &&
                Math.abs(dateStamp(reset.created_at)-dateStamp(dq.created_at))<=2*60*1000;
        };
        function collapsePairedResets(records){
            const disqualifications=records.filter(event=>event?.type==='disqualify');
            return records.filter(event=>!(['nomination_reset','nomination_reset_received'].includes(event?.type) &&
                disqualifications.some(dq=>sameDisqualification(event,dq))));
        }
        if(!entries.length){box.append(el('p','No recent modding events.','kmh-activity-hint'));return;}
        const eventHolder=el('div',null,'kmh-event-list-container');box.append(eventHolder);
        function drawEvents(){
        const rows=collapsePairedResets(entries).map(e=>{
            const type=String(e.type),set=e.beatmapset||{},setId=Number(set.id||e.beatmapset_id);
            const discussionId=Number(e.discussion?.id||e.comment?.beatmap_discussion_id);
            const who=names.get(Number(e.user_id));
            const author=names.get(Number(e.discussion?.user_id));
            const presentation=presentationForEvent(e);
            let title=presentation.label;
            if(type==='issue_resolve'||type==='issue_reopen')title=`Issue #${discussionId>0?discussionId:'—'} ${type==='issue_resolve'?'resolved':'reopened'}`;
            const sub=String(set.title||`Beatmapset #${setId||'?'}`);
            const href=(discussionId>0&&setId>0)
                ? `https://osu.ppy.sh/beatmapsets/${setId}/discussion#/${discussionId}` : safeSetLink(setId);
            const annotation=[author&&discussionId>0?`Issue by ${author}`:'',who?`Action by ${who}`:''].filter(Boolean).join(' · ');
            const row=eventListItem(title,sub,e.created_at,href,coverFor(set,setId),presentation.tone,annotation,presentation.icon);
            row.dataset.eventType=type;
            if(presentation.iconTone)row.dataset.iconTone=presentation.iconTone;
            return row;
        });
        const holder=box.querySelector('.kmh-event-list-container');holder.replaceChildren();
        listWithShowMore(holder,rows,10);
        }
        drawEvents();
        // The user-filtered feed can omit a DQ performed by another BN. Only
        // add a DQ when osu!'s per-beatmapset feed actually reports it.
        if(entries.some(e=>e.type==='nomination_reset'||e.type==='nomination_reset_received')){
            void supplementalDisqualifications(entries).then(extra=>{
                if(!box.isConnected || !extra.events.length)return;
                for(const user of extra.users) if(user?.id)names.set(Number(user.id),String(user.username||''));
                const known=new Set(entries.map(e=>String(e.id||'')));
                const fresh=extra.events.filter(e=>!known.has(String(e.id||'')));
                if(!fresh.length)return;
                entries=[...entries,...fresh].sort((a,b)=>dateStamp(b.created_at)-dateStamp(a.created_at)).slice(0,40);
                drawEvents();
            }).catch(()=>{});
        }
        const profile=el('a','See modding history ↗','kmh-quick-link');
        profile.href=`https://osu.ppy.sh/users/${id}/modding#events`;profile.target='_blank';profile.rel='noopener noreferrer';
        box.append(profile);
    }

    const unresolvedIssueCounts = new Map();
    async function fetchBlockingIssueCount(setId){
        const id=Number(setId);
        if(!Number.isSafeInteger(id)||id<=0)return null;
        if(unresolvedIssueCounts.has(id))return unresolvedIssueCounts.get(id);
        const pending=request({action:'fetchDiscussions',filters:{beatmapset_id:id,only_unresolved:true}})
            .then(data=>{
                if(!Array.isArray(data?.discussions))return null;
                const items=data.discussions.filter(d=>(d.message_type==='problem'||d.message_type==='suggestion')&&!d.resolved)
                    .sort((a,b)=>dateStamp(b.created_at)-dateStamp(a.created_at));
                return {count:items.length,discussionId:Number(items[0]?.id)||null,hasMore:!!data.cursor_string};
            }).catch(()=>null);
        unresolvedIssueCounts.set(id,pending);
        const result=await pending;
        unresolvedIssueCounts.set(id,result);
        return result;
    }
    function updateIssueBadge(target,info,setId){
        if(!target||!info||!Number.isFinite(info.count)||info.count<=0)return;
        const marker=icon('fas fa-exclamation-circle');marker.setAttribute('aria-hidden','true');
        const countLabel=info.hasMore?`${info.count}+`:String(info.count);
        target.replaceChildren(marker,document.createTextNode(countLabel));target.hidden=false;
        target.title=`${countLabel} unresolved ${info.count===1&&!info.hasMore?'issue':'issues'} in the retrieved discussion page · Open discussion`;
        target.setAttribute('aria-label',target.title);target.dataset.level='warning';
        // The whole card is already a link: don't nest anchors inside anchors.
        const card=target.closest('.kmh-nomination-card');
        if(card){card.href=`https://osu.ppy.sh/beatmapsets/${setId}/discussion${info.discussionId?`#/${info.discussionId}`:''}`;
            card.title=info.discussionId?'Open most recent unresolved issue':'Open beatmap discussions';}
    }
    function presentationForEvent(event){
        // Separate event types are authoritative. Never infer a DQ from the
        // prose or from the fact that a nomination was reset.
        const type=String(event?.type||'');
        return eventPresentation[type] || {label:type||'Event',icon:'fas fa-circle',tone:'info'};
    }
    async function supplementalDisqualifications(raw){
        const resets=raw.filter(e=>e?.type==='nomination_reset'||e?.type==='nomination_reset_received');
        const ids=[...new Set(resets.map(e=>Number(e?.beatmapset?.id||e?.beatmapset_id)).filter(n=>Number.isSafeInteger(n)&&n>0))].slice(0,4);
        if(!ids.length)return {events:[],users:[]};
        const records=await Promise.allSettled(ids.map(setId=>request({action:'fetchBeatmapsetEventsForSet',setId})));
        const events=[],users=[];
        for(const result of records){
            if(result.status!=='fulfilled')continue;
            const data=result.value;
            if(Array.isArray(data?.users))users.push(...data.users);
            for(const event of eventCollection(data)){
                if(event?.type!=='disqualify')continue;
                const id=Number(event.beatmapset_id||event.beatmapset?.id);
                const nearby=resets.some(reset=>Number(reset.beatmapset_id||reset.beatmapset?.id)===id &&
                    Math.abs(dateStamp(event.created_at)-dateStamp(reset.created_at))<=7*24*3600000 &&
                    dateStamp(event.created_at)>0 && dateStamp(reset.created_at)>0);
                if(nearby)events.push(event);
            }
        }
        return {events,users};
    }
    function renderNominations(parent,sets,full,userId){
        const box=section(parent,'Nominated Beatmapsets','', 'kmh-nomination-panel');
        const total=Number(full?.nominated_beatmapset_count);
        const metric=el('div',null,'kmh-large-stat');
        metric.append(el('span','Total nominated beatmapsets','kmh-large-stat-label'),
            el('strong',Number.isFinite(total)&&total>=0?prettyNumber(total):'—','kmh-large-stat-value'));
        box.append(metric);
        const links=el('div',null,'kmh-nomination-links');
        const osuLink=el('a','osu! profile ↗','kmh-quick-link');
        osuLink.href=`https://osu.ppy.sh/users/${Number(userId)}`;osuLink.target='_blank';osuLink.rel='noopener noreferrer';
        const bnLink=el('a','BN Management ↗','kmh-quick-link');
        bnLink.href='https://bn.mappersguild.com/';bnLink.target='_blank';bnLink.rel='noopener noreferrer';
        links.append(osuLink,bnLink);box.append(links);
        if(!Array.isArray(sets)){
            box.append(el('p','Nomination list unavailable.','kmh-activity-hint'));return;
        }
        const gallery=el('div',null,'kmh-nomination-gallery');
        for(const set of sets){const href=safeSetLink(set.id);if(!href)continue;
            const card=el('a',null,'kmh-nomination-card');card.href=href+'/discussion';card.target='_blank';card.rel='noopener noreferrer';card.title='Open beatmap discussion';
            const art=el('span',null,'kmh-nomination-art');
            const cover=coverFor(set,set.id);
            if(cover){const img=el('img');img.src=cover;img.alt='';img.loading='lazy';img.referrerPolicy='no-referrer';
                img.onerror=()=>{img.remove();art.classList.add('is-empty');};art.append(img);}
            else art.classList.add('is-empty');
            const content=el('div',null,'kmh-nomination-card-copy');
            content.append(el('strong',String(set.title||'Untitled beatmapset')));
            if(set.artist)content.append(el('span',`by ${String(set.artist)}`,'kmh-nomination-artist'));
            const mapper=String(set.creator||set.user?.username||'');
            if(mapper)content.append(el('small',`mapped by ${mapper}`,'kmh-nomination-mapper'));
            const meta=el('div',null,'kmh-nomination-meta');
            const status=el('span',String(set.status||'Unknown').toUpperCase(),'kmh-nomination-chip');status.dataset.status=String(set.status||'unknown').toLowerCase();meta.append(status);
            // Issues are only relevant while a set is awaiting / undergoing qualification.
            // Ranked, approved and Loved sets never display an outdated issue counter.
            const needsIssueCheck=['qualified','pending','wip'].includes(String(set.status||'').toLowerCase());
            if(needsIssueCheck){
                const issueBadge=el('span',null,'kmh-nomination-issue-badge');issueBadge.hidden=true;meta.append(issueBadge);
                void fetchBlockingIssueCount(set.id).then(info=>{if(issueBadge.isConnected)updateIssueBadge(issueBadge,info,set.id);});
            }
            content.append(meta);
            card.append(art,content);gallery.append(card);
        }
        if(sets.length)box.append(gallery);
        else box.append(el('p','No nominated beatmapsets in the returned page.','kmh-activity-hint'));
        box.append(el('small',`Showing ${sets.length} returned mapsets`,'kmh-activity-hint'));
    }
    async function loadAccountActivity(turn,results){
        results.replaceChildren(el('p','Loading activity…','kmh-fetch-status'));
        const staff=isVerifiedStaff(profile),id=Number(profile.id);
        const [historyResponse,eventsResponse,nominatedResponse,publicResponse]=await Promise.allSettled([
            request({action:'fetchKudosuHistory',userId:id}),
            request({action:'fetchBeatmapsetEvents',userId:id}),
            staff?request({action:'fetchNominatedSets',userId:id}):Promise.resolve(null),
            request({action:'fetchPublicUser',userId:id}),
        ]);
        if(turn!==generation)return;
        results.replaceChildren();panel.querySelector('[data-counts]').replaceChildren();
        const full=publicResponse.status==='fulfilled'?publicResponse.value:profile;
        const history=section(results,'Kudosu!','', 'kmh-kudosu-panel');
        const total=Number(full?.kudosu?.total??profile?.kudosu?.total);
        const metric=el('div',null,'kmh-large-stat');
        metric.append(el('span','Total kudosu earned','kmh-large-stat-label'),el('strong',Number.isFinite(total)&&total>=0?prettyNumber(total):'—','kmh-large-stat-value'));
        history.append(metric);
        if(historyResponse.status==='fulfilled'&&Array.isArray(historyResponse.value)){
            const entries=historyResponse.value;
            if(!entries.length)history.append(el('p','No recent kudosu entries.','kmh-activity-hint'));
            const lazyArtwork=[];
            const rows=entries.slice(0,20).map(entry=>{
                const amount=Number(entry.amount),gain=Number.isFinite(amount)?`${String(entry.action||'').includes('reset')||String(entry.action||'').includes('revoke')?'-':'+'}${Math.abs(amount)}`:'—';
                const label=String(entry.post?.title||'Modding post');
                const href=(()=>{try{const u=new URL(String(entry.post?.url||''),'https://osu.ppy.sh');return u.protocol==='https:'&&u.hostname==='osu.ppy.sh'?u.href:'';}catch{return '';}})();
                const setId=mapsetIdFromUrl(href);
                const discussionId=discussionIdFromUrl(href);
                const lost=gain.startsWith('-');
                const tone=lost?'danger':'nomination';
                const row=eventListItem(`${gain} kudosu`,label,entry.created_at||entry.date,href,coverFor(entry.post?.beatmapset,setId),tone,'',lost?'fas fa-thumbs-down':'fas fa-thumbs-up');
                // An osu! kudosu discussion link has a discussion ID, not a
                // beatmapset ID. Resolve its parent via the official API.
                lazyArtwork.push(() => {if(discussionId && !setId)void kudosuArtworkForDiscussion(discussionId).then(url => showKudosuArtwork(row,url));});
                return row;
            });
            listWithShowMore(history,rows,5,()=>lazyArtwork.slice(5).forEach(load=>load()));
            lazyArtwork.slice(0,5).forEach(load=>load());
        }else history.append(el('p','Kudosu history unavailable.','kmh-activity-hint'));
        if(eventsResponse.status==='fulfilled')renderModdingEvents(results,eventsResponse.value,id);
        else section(results,'Recent Events','').append(el('p','Modding history unavailable.','kmh-activity-hint'));
        if(staff){const sets=nominatedResponse.status==='fulfilled'?nominatedResponse.value:null;
            renderNominations(results,sets,full||profile,id);}
        panel.querySelector('[data-coverage]').textContent='osu! modding history · public events only';
    }
    async function loadView(more = false) {
        if (!panel) return;
        const turn=++generation, results=panel.querySelector('[data-results]'), load=panel.querySelector('[data-more]');
        panel.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===view)));
        panel.querySelector('[data-results-label]').textContent=view==='activity'?'MODDING ACTIVITY':'RECENT DISCUSSIONS · UPDATES';
        load.hidden=true;
        for(const key of ['filter','sort','search','date-from','date-to','load-target']) {
            const n=panel.querySelector(`[data-${key}]`);if(!n)continue;
            const hide=view!=='mine';
            (key==='search'?n.parentElement:key==='filter'?n.closest('.kmh-status-filter'):key==='date-from'||key==='date-to'||key==='load-target'?n.closest('label'):n).hidden=hide;
        }
        panel.querySelector('[data-categories]').hidden=view!=='mine';
        panel.querySelector('.kmh-mark-all-read').hidden=view!=='mine';
        panel.querySelector('.kmh-review-checkpoint').hidden=true;
        if(!profile) {discussions=[];cursor=null;panel.querySelector('[data-coverage]').textContent='';panel.querySelector('[data-counts]').replaceChildren();results.replaceChildren();const empty=el('div',null,'kmh-empty-state kmh-auth-empty');empty.append(el('i',null,accountAuthenticated?'fas fa-exclamation-circle':'fas fa-lock'),el('strong',accountAuthenticated?'Unable to load profile':'Connect your osu! account'),el('p',accountAuthenticated?(accountProblem||'Your session is connected. Try Refresh to fetch your profile again.'):'Authorize osu! to load your personal discussions and history.'));results.append(empty);return;}
        if(view==='activity'){threadObserver?.disconnect();threadObserver=null;
            const menu=panel.querySelector('.kmh-status-menu'),trigger=panel.querySelector('.kmh-status-trigger');
            if(menu)menu.hidden=true;if(trigger)trigger.setAttribute('aria-expanded','false');
            load.hidden=true;void loadAccountActivity(turn,results);return;}
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
                const userLookup=new Map((Array.isArray(data?.users)?data.users:[]).map(u=>[Number(u.id),u]));
                const batch=(data?.discussions||[]).map(d=>({...d,
                    author: d.author || userLookup.get(Number(d.starting_post?.user_id||d.user_id)) || d.user || null,
                    beatmap:d.beatmap||data.beatmaps?.find(b=>b.id===d.beatmap_id),
                    beatmapset:d.beatmapset||data.beatmapsets?.find(b=>b.id===d.beatmapset_id)||(d.beatmapset_id===mapData().id?mapData():null)
                }));
                rows=[...new Map([...rows,...batch].map(d=>[d.id,d])).values()];
                lastCursor=nextCursor;nextCursor=data?.cursor_string||null;pages++;
                if(!nextCursor||!batch.length||nextCursor===lastCursor)break;
                // Cap a single automatic run at 10 pages; further history requires clicking Load more.
                if(pages>=10)break;
            }
            discussions=rows;cursor=nextCursor;allLoaded=!cursor;
            await baselineDiscussions(rows);await verifyExternalReplies(rows);if(turn!==generation)return;
            if(view==='mine')trackedMine=rows;
            drawRows(rows);load.hidden=!cursor;
        } catch(error){if(turn!==generation)return;discussions=rows;drawRows(rows);results.prepend(el('p',`History loading stopped: ${error.message}. Already retrieved pages remain available.`,'kmh-fetch-error'));load.hidden=!nextCursor;cursor=nextCursor;}
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
        const title=el('h2','Recent Discussions');title.id='kmh-finder-title';heroText.append(title,el('p','Review your modposts, new replies and resolution changes.'));
        const close=button('×',closeWorkspace,'kmh-icon-button');close.dataset.close='';close.setAttribute('aria-label','Close Recent Discussions');
        const helperActions=el('div',null,'kmh-workspace-hero-tools');
        helperActions.append(button('⚙ Settings',()=>{closeWorkspace();window.KmhOpenSettings?.();},'kmh-outline-button'),close);
        hero.append(heroText,helperActions);
        const accountStrip=el('div',null,'kmh-account-strip');const account=el('div');account.dataset.account='';
        const connectButton=button('Connect osu! account ↗',connect,'kmh-primary-button');connectButton.dataset.connect='';accountStrip.append(account,connectButton);
        const layout=el('div',null,'kmh-workspace-layout');const sidebar=el('nav',null,'kmh-workspace-sidebar');sidebar.setAttribute('aria-label','Workspace views');
        sidebar.append(el('div','BROWSE','kmh-sidebar-title'));
        for(const [id,label,icon] of [['mine','Recent Discussions','fas fa-comments'],['activity','Modding Activity','fas fa-history']]) {
            const tab=button(label,()=>{view=id;searchQuery=''; const field=panel.querySelector('[data-search]');if(field)field.value='';loadView(false);},'kmh-nav-tab');
            tab.dataset.view=id;const graphic=el('i',null,icon);tab.prepend(graphic);
            if(id==='mine'){const unread=el('span','', 'kmh-nav-unread');unread.dataset.unreadTab='';unread.hidden=true;tab.append(unread);}
            sidebar.append(tab);
        }
        const hint=el('div',null,'kmh-sidebar-hint');hint.append(el('strong','Read status'),el('p','New replies and resolution changes. Saved on this device.'));sidebar.append(hint);
        const main=el('main',null,'kmh-workspace-main');
        const mainHead=el('div',null,'kmh-list-header');const viewName=el('div','DISCUSSION RESULTS','kmh-eyebrow');viewName.dataset.resultsLabel='';mainHead.append(viewName);
        const refresh=button('↻ Refresh',()=>loadView(false),'kmh-outline-button kmh-refresh-action');
        const markAll=button('✓ Mark all read',markAllRead,'kmh-outline-button kmh-mark-all-read kmh-positive-action');
        markAll.title='Mark every loaded discussion as read in this browser';
        const headActions=el('div',null,'kmh-list-header-actions');headActions.append(markAll,refresh);mainHead.append(headActions);
        const counts=el('div',null,'kmh-workspace-counts');counts.dataset.counts='';
        const controls=el('div',null,'kmh-workspace-controls');
        const search=el('input');search.type='search';search.placeholder='Search discussions…';search.dataset.search='';search.setAttribute('aria-label','Search loaded discussions');
        search.oninput=()=>{searchQuery=search.value; if(view==='favourites')return;drawRows(discussions);};
        const searchHolder=el('label',null,'kmh-search-wrap');searchHolder.append(el('i',null,'fas fa-search'),search);controls.append(searchHolder);
        const filter=el('select');filter.dataset.filter='';filter.setAttribute('aria-label','Discussion status');
        for(const [value,label] of [['all','All statuses'],['unresolved','Open only'],['resolved','Resolved only'],['unread','Unread activity']]) { const option=el('option',label);option.value=value;filter.append(option); }
        filter.onchange=()=>drawRows(discussions);
        const statusControl=el('div',null,'kmh-status-filter');
        filter.className='kmh-status-native';filter.hidden=true;filter.tabIndex=-1;filter.setAttribute('aria-hidden','true');
        const statusTrigger=button('',()=>{},'kmh-status-trigger');
        statusTrigger.setAttribute('aria-label','Filter discussion status');statusTrigger.setAttribute('aria-expanded','false');
        const statusGlyph=icon('fas fa-layer-group kmh-status-current-icon');statusGlyph.setAttribute('aria-hidden','true');
        const statusText=el('span','All statuses','kmh-status-trigger-label');
        const chevron=icon('fas fa-chevron-down');chevron.setAttribute('aria-hidden','true');
        statusTrigger.dataset.value='all';
        statusTrigger.append(statusGlyph,statusText,chevron);
        const statusMenu=el('div',null,'kmh-status-menu');statusMenu.hidden=true;statusMenu.setAttribute('role','menu');
        statusMenu.setAttribute('aria-label','Discussion status');
        const statusIcons={all:'fas fa-layer-group',unresolved:'fas fa-exclamation-circle',resolved:'fas fa-check-circle',unread:'fas fa-bell'};
        const statusOptions=[...filter.options].map(option=>{
            const opt=button('',()=>{},'kmh-status-option');opt.dataset.value=option.value;
            opt.setAttribute('role','menuitemradio');opt.setAttribute('aria-checked',String(filter.value===option.value));
            opt.prepend(icon(`${statusIcons[option.value]||'fas fa-filter'} kmh-status-option-icon`));opt.append(el('span',option.textContent),icon('fas fa-check kmh-status-selected-icon'));statusMenu.append(opt);return opt;
        });
        const hideStatusMenu=(focus=false)=>{statusMenu.hidden=true;statusTrigger.setAttribute('aria-expanded','false');if(focus)statusTrigger.focus();};
        const setFilter=value=>{
            filter.value=value;statusText.textContent=filter.selectedOptions[0]?.textContent||'All statuses';statusTrigger.dataset.value=value;statusGlyph.className=`${statusIcons[value]||'fas fa-filter'} kmh-status-current-icon`;
            statusOptions.forEach(o=>o.setAttribute('aria-checked',String(o.dataset.value===value)));
            hideStatusMenu(true);filter.dispatchEvent(new Event('change'));
        };
        statusOptions.forEach(option=>{option.onclick=()=>setFilter(option.dataset.value);
            option.onkeydown=e=>{
                if(e.key==='Escape'){e.preventDefault();hideStatusMenu(true);}
                else if(['ArrowDown','ArrowUp'].includes(e.key)){
                    e.preventDefault();const i=statusOptions.indexOf(option),step=e.key==='ArrowDown'?1:-1;
                    statusOptions[(i+step+statusOptions.length)%statusOptions.length].focus();
                }
            };
        });
        statusTrigger.onclick=()=>{
            const opening=statusMenu.hidden;statusMenu.hidden=!opening;statusTrigger.setAttribute('aria-expanded',String(opening));
            if(opening)statusOptions.find(o=>o.dataset.value===filter.value)?.focus();
        };
        statusTrigger.onkeydown=e=>{if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();statusTrigger.onclick();}};
        statusControl.addEventListener('focusout',e=>{if(!statusControl.contains(e.relatedTarget))hideStatusMenu();});
        document.addEventListener('pointerdown',e=>{if(!statusControl.contains(e.target))hideStatusMenu();});
        statusControl.append(filter,statusTrigger,statusMenu);controls.append(statusControl);
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
        for(const [value,label] of [['problem','Problem'],['suggestion','Suggestion'],['hype','Hype'],['praise','Praise'],['mapper_note','Note']]) {
            const category=el('label',null,'kmh-category-toggle');category.dataset.type=value;
            category.style.setProperty('--kmh-discussion-accent',typeStyles[value].color);
            const input=el('input');input.type='checkbox';input.value=value;input.checked=categories.has(value);
            input.onchange=()=>{input.checked?categories.add(value):categories.delete(value);drawRows(discussions);};
            category.append(input,icon(typeStyles[value].icon),document.createTextNode(label));
            category.setAttribute('aria-label',label);types.append(category);
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
        main.append(mainHead,counts,controls,types,scroll);layout.append(sidebar,main);        const profileShell=el('div',null,'kmh-profile-shell');profileShell.append(hero,accountStrip);panel.append(profileShell,layout);
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
            await verifyExternalReplies(rows);
            trackedMine=rows;
            // Lightweight activity checks cover the newest 50; the full workspace can fetch more pages on demand.
            updateUnreadBadges(rows);
            if(overlay && !overlay.hidden && view==='mine')await loadView(false);
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
        const next = `${mapData().id}:${currentBeatmap()}`;
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
    window.KmhWorkspace = { scan, parseTimestamp, matchRelated, loadView, open:openWorkspace, close:closeWorkspace, checkActivity };
    window.addEventListener('mod-helper-osu-auth-changed', () => { if (panel) refreshAccount(); });
    chrome.storage?.onChanged?.addListener?.((changes,area)=>{if(area==='local'&&changes.osuAuthToken&&panel)refreshAccount();});
    window.addEventListener('mod-helper-settings-changed', scan);
    scan();
})();

