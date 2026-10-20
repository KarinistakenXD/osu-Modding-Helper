/* Draft Coach: deliberately local / deterministic. The handbook is teaching material,
 * not official osu! policy; this module never certifies rule violations. */
(function(root){
  'use strict';
  const RULES_URL='https://osu.ppy.sh/wiki/en/Ranking_criteria';
  const MANIA_URL='https://osu.ppy.sh/wiki/en/Ranking_criteria/osu%21mania';
  const patterns={
    where:/\b(?:\d{1,3}:[0-5]\d(?::\d{1,3})?|verse|chorus|drop|bridge|buildup|intro|outro|measure|bar\s*\d+|section|spread|all difficulties|throughout|entire|metadata|timing|full(?:\s+song|\s+mapset)?|song[ -]wide|set[ -]wide|general)\b/i,
    evidence:/\b(?:at|there|here|uses?|follows?|repeats?|changes?|shifts?|introduces?|creates?|places?|notes?|objects?|streams?|chords?|jacks?|holds?|l[nr]s?|snaps?|rhythm|vocals?|percussion|synth|bass|melody|pattern|audio|timing|column|hand|phrase|release|tempo|\d{1,2}\/?\d{1,2})\b/i,
    why:/\b(?:because|since|as a result|due to|therefore|so that|which (?:means|makes|causes|creates)|leading to|results? in|even though|despite|although|whereas)\b/i,
    impact:/\b(?:playab\w*|readab\w*|stamina|strain|difficult|techni\w*|fingers?|hands?|release|rhythmi\w*|musical|layer|accent|expect|harder|easier|coordination|consisten\w*|emphasis|represent\w*|density|intensity|strain|flow|sound|song|player|motif|transition)\b/i,
    solution:/\b(?:consider|recommend|suggest|could|would|replace|move|shift|reduce|increase|keep|preserve|remove|add|adjust|simplify|introduce|change|rearrange|rework|recheck|verify|try)\b/i,
    comparison:/\b(?:compared|comparison|similar|earlier|later|previous|repeated|repeat|other (?:section|measure|part|chorus)|elsewhere|neighbor\w*|surrounding|unlike|consistent with|first chorus|second chorus|contrasts?)\b/i,
    alternative:/\b(?:alternatively|another (?:option|approach)|otherwise|instead|either|if (?:your|the) intention|or (?:we|you|the mapper) could|option [ab]|trade[ -]?off)\b/i
  };
  const riskyAuthority=/\b(?:NAT (?:will|would|must)|BNs? (?:will|would|must)|unrankable|breaks? (?:the )?(?:RC|ranking criteria)|(?:RC|ranking criteria) (?:requires?|forbids?|states?|says?))\b/i;
  const bareJudgement=/\b(?:bad|wrong|awkward|unplayable|inconsistent|overmapped|undermapped|terrible|weird)\b/i;
  const siteBBCode=/\[(?:img|url|b|i|quote)(?:=[^\]]+)?\]/i;
  function inspectMarkdown(text){
    const notes=[];
    const fenceCount=(text.match(/^\s*```/gm)||[]).length;
    if(fenceCount%2)notes.push({level:'warn',title:'Unclosed code fence',detail:'A triple-backtick code block appears to be missing its matching closing fence.'});
    if(siteBBCode.test(text))notes.push({level:'warn',title:'BBCode found in a Markdown discussion',detail:'This editor uses Markdown. Preview carefully, or convert simple legacy tags to Markdown.'});
    const badLinks=(text.match(/\]\((?!https?:\/\/|osu:\/\/|#|\.\/|\.\.\/|\/)[^)]*\)/gi)||[]);
    if(badLinks.length)notes.push({level:'info',title:'Check Markdown link targets',detail:'Some links use a relative or unusual destination. Confirm they render and open correctly.'});
    if(/https?:\/\/\S+\.(?:png|jpe?g|gif|webp)(?:\?\S+)?/i.test(text) && !/!\[[^\]]*\]\(https?:\/\//i.test(text))notes.push({level:'info',title:'Image link detected',detail:'For an inline image, use ![](https://image-url). A plain link may be intentional.'});
    if(/\[\[[^\]]+\]\]/.test(text))notes.push({level:'info',title:'Double brackets',detail:'Check whether this is intended text or a malformed Markdown link.'});
    if((text.match(/\*\*/g)||[]).length%2)notes.push({level:'warn',title:'Unpaired bold delimiter',detail:'An odd number of ** delimiters may leave unwanted formatting.'});
    return notes;
  }
  function cleanupMarkdown(raw){
    let s=String(raw||'');
    // Only mechanical, transparent conversion; intentionally do not rewrite reasoning.
    s=s.replace(/\[img\](https?:\/\/[^\s\[\]]+)\[\/img\]/gi,'![]($1)');
    s=s.replace(/\[url=(https?:\/\/[^\]\s]+)\]([^\[]+)\[\/url\]/gi,'[$2]($1)');
    s=s.replace(/\[b\]([\s\S]*?)\[\/b\]/gi,'**$1**');
    s=s.replace(/\[i\]([\s\S]*?)\[\/i\]/gi,'*$1*');
    return s;
  }
  // Topic suggestions are research pointers, never claims that a map violates RC.
  const topics=[
    {pattern:/\b(?:overlap|same column|same lane|double note|duplicate object)\b/i,title:'Simultaneous objects',detail:'Inspect the actual object columns and timing in the editor. Check the current mania General rules before calling this a mandatory fix.',url:MANIA_URL},
    {pattern:/\b(?:LN|long note|hold note|release|tail|shield)\b/i,title:'Long-note / release design',detail:'Reconstruct press, hold and release demands. Compare the surrounding phrase and difficulty expectations; text alone cannot validate the chart.',url:MANIA_URL},
    {pattern:/\b(?:spread|easy|normal|hard|insane|expert|difficulty gap)\b/i,title:'Difficulty progression',detail:'Compare equivalent musical phrases and technique demands across adjacent difficulties. Use the current mode-specific RC for enforceable limits.',url:MANIA_URL},
    {pattern:/\b(?:BPM|offset|snapping|red line|timing point|syncopation)\b/i,title:'Timing and snapping',detail:'Verify tempo/offset in multiple sections against audio and editor timing, not just a reported number.',url:RULES_URL},
    {pattern:/\b(?:metadata|title|romanization|romanisation|tag|genre|artist credit|source)\b/i,title:'Metadata and sourcing',detail:'Use the authoritative release credit. Separate discoverability suggestions from mandatory metadata formatting.',url:'https://osu.ppy.sh/wiki/en/Ranking_criteria/Metadata'},
    {pattern:/\b(?:hitsound|sample|storyboard|video|audio|image|background|codec)\b/i,title:'Technical assets',detail:'Check the actual media files, loudness and format, and cite the specific current requirement when necessary.',url:RULES_URL}
  ];
  function analyze(text, opts={}){
    const draft=String(text||'').trim(), postType=opts.postType||'unspecified';
    const checks=Object.fromEntries(Object.entries(patterns).map(([key,pattern])=>[key,pattern.test(draft)]));
    const notes=[], wordCount=(draft.match(/[\p{L}\p{N}]+/gu)||[]).length;
    const add=(level,category,title,detail)=>notes.push({level,category,title,detail});
    if(!draft){add('warn','judgement','No draft to inspect','Type or import a mod post. The coach never posts anything automatically.');}
    else {
      if(!checks.where)add('warn','judgement','Scope is unclear','Name the affected section, timestamp, difficulty, or set-wide scope. General concerns do not always need timestamps.');
      if(!checks.evidence)add('warn','judgement','Observation needs evidence','Describe what the map does, rather than relying on a judgement adjective.');
      if(!checks.why || !checks.impact)add('warn','judgement','Explain the mechanism and consequence','State why this choice affects musical representation, gameplay, readability, difficulty or technique.');
      if(!checks.solution)add('warn','judgement','No concrete repair direction detected','Suggest what should change, and identify what is worth preserving. A question about mapper intent can also be appropriate.');
      if(!checks.comparison && wordCount>=35)add('info','judgement','Consider a structural comparison','For important issues, compare an analogous phrase or nearby pattern where that supports the diagnosis.');
      if(!checks.alternative && wordCount>=50)add('info','judgement','Test an alternative repair','Especially for foundational problems, assess two ways of fixing the cause rather than one local symptom.');
      if(bareJudgement.test(draft) && (!checks.why || !checks.impact))add('warn','writing','Unqualified judgement language','Words such as “awkward” or “inconsistent” need an observable mechanism, not just stronger adjectives.');
      if(riskyAuthority.test(draft))add('warn','rc','An RC or authority claim needs independent verification','The draft seems to assert rankability or an official consensus. Verify the applicable current Rule/Guideline and cite it; a draft review cannot establish a violation.');
      if(postType==='problem' && (!checks.why || !checks.solution))add('warn','rc','Problem label needs stronger support','Your handbook recommends Problem for enforceable breaches or substantial defensible issues. Review evidence and impact before choosing the site label.');
      if(postType==='suggestion' && riskyAuthority.test(draft))add('info','rc','Severity and label may disagree','A confirmed mandatory requirement is not equivalent to an optional preference. Re-evaluate after verifying the live RC.');
      if(/\b(?:every|always|never|obviously|clearly)\b/i.test(draft) && riskyAuthority.test(draft))add('info','writing','Calibrate absolute wording','Match the strength of your wording to evidence; avoid implying an official consensus without support.');
    }
    inspectMarkdown(draft).forEach(note=>notes.push({...note,category:'formatting'}));
    const relevantTopics=topics.filter(topic=>topic.pattern.test(draft)).slice(0,4);
    const essential=['where','evidence','why','impact','solution'];
    const covered=essential.filter(key=>checks[key]).length;
    return {wordCount,checks,covered,total:essential.length,notes,relevantTopics,postType,links:[{label:'General Ranking Criteria',url:RULES_URL},{label:'osu!mania Ranking Criteria',url:MANIA_URL}],disclaimer:'Pattern-based writing guidance only. This is not an AI model, RC violation detector, gameplay validator, or official BN/NAT assessment.'};
  }
  root.KmhCoachCore=Object.freeze({analyze,cleanupMarkdown,inspectMarkdown});
})(typeof window==='undefined'?globalThis:window);
