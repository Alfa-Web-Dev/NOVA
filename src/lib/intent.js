const GREET = /^(hi+|hello+|hey+|helo+|yo|sup|good (morning|afternoon|evening|night)|namaste|namaskar|नमस्ते|नमस्कार|हाय|हेलो|hola|bonjour|salaam|salam|assalamu alaikum)(?![\p{L}\p{M}])[!.\s,😊👋🙏]*(nova)?[!.\s]*$/iu;
export const isGreeting = (q) => GREET.test(q.trim());
export const isThanks = (q) => /^(thanks|thank you|thx|ty|shukriya|धन्यवाद|शुक्रिया)(?![\p{L}\p{M}])[!.\s]*$/iu.test(q.trim());
export const wantsImages = (q) => /\b(image|images|picture|pictures|photo|photos|diagram|illustration|show me|draw|map of|chart)\b/i.test(q);
export const wantsVideos = (q) => /\b(video|videos|watch|tutorial|documentary|lecture)\b/i.test(q);
export const wantsResearch = (q) => /\b(research|academic|journal|paper|papers|study|studies|literature|doi|peer.review|scientific|clinical|trial)\b/i.test(q);
export const wantsBooks = (q) => /\b(book|books|novel|author|isbn|read about)\b/i.test(q);
export const isCode = (q) => /\b(code|coding|program(ming)?|function|javascript|typescript|python|java|c\+\+|rust|golang|html|css|react|node|npm|bug|error|exception|stack ?trace|api|sql|regex|algorithm|git|docker|linux|android|kotlin|swift)\b/i.test(q);
export const isCurrent = (q) => /\b(latest|today|current|news|breaking|recent|this (week|month|year)|202[5-9]|price|election|president|prime minister)\b/i.test(q);
export const wantsTravel = (q) => /\b(travel|visit|trip|tourist|tourism|things to do|attractions|itinerary|sightseeing|where to stay)\b/i.test(q);
export const wantsLearning = (q) => /\b(how to|tutorial|learn|lesson|course|guide|textbook|study|syllabus|explain)\b/i.test(q);
export const isSpace = (q) => /\b(nasa|space|planet|galaxy|moon|mars|jupiter|saturn|venus|star|stars|telescope|astronaut|rocket|satellite|solar system|black hole|nebula|comet|asteroid|eclipse|cosmos)\b/i.test(q);
export function countryName(q) {
  const m = /\b(?:capital|population|currency|flag|area|language|languages|president|prime minister|continent|neighbou?rs|country)\b.*?\b(?:of|in|for)\s+([\p{L}][\p{L}\s'.-]{1,40}?)[?.!]*$/iu.exec(q.trim());
  return m ? m[1].trim() : null;
}
export function currencyQuery(q) {
  const m = /(\d[\d,]*\.?\d*)\s*([a-z]{3})\s*(?:to|in|into|=)\s*([a-z]{3})\b/i.exec(q);
  return m ? { amount: parseFloat(m[1].replace(/,/g, '')), from: m[2].toUpperCase(), to: m[3].toUpperCase() } : null;
}
/** Returns the word/phrase to define, or null. Single plain words are treated as dictionary lookups too. */
export function defineTarget(q) {
  const t = q.trim().replace(/[?.!]+$/, '');
  let m = /^(?:define|definition of|meaning of|what(?:'s| is) the meaning of|what does)\s+(.+?)(?:\s+mean)?$/i.exec(t);
  if (m) return m[1].trim();
  return /^\p{L}{4,20}$/u.test(t) && !isGreeting(t) && !isThanks(t) ? t : null; // a single plain word = dictionary lookup
}
export const isMedical = (q) => /\b(disease|symptom|treatment|medicine|drug|dose|cancer|diabetes|therapy|vaccine|infection)\b/i.test(q);

export function weatherPlace(q) {
  const m = /\b(?:weather|temperature|forecast|rain|mausam|मौसम)\b.*?\b(?:in|at|for|of|near)\s+([\p{L}][\p{L}\s.,'-]{1,40}?)\s*(?:today|now|tomorrow|this week)?[?.!]*$/iu.exec(q.trim())
    || /^([\p{L}][\p{L}\s.,'-]{1,40}?)\s+(?:weather|temperature|forecast)[?.!]*$/iu.exec(q.trim());
  return m ? m[1].trim() : null;
}

export function classifyTopic(q) {
  const t = q.toLowerCase();
  if (/\b(solve|equation|math|mathematics|calculate|formula|integral|geometry|algebra|probability|derivative)\b/.test(t)) return 'math';
  if (/\b(code|program|function|javascript|python|java|html|css|react|bug|error|api|sql|algorithm)\b/.test(t)) return 'code';
  if (/\b(history|historical|revolution|war|empire|civilization|when did|who was|constitution|geography|civics)\b/.test(t)) return 'history';
  if (/\b(latest|today|current|news|202[5-9]|price|president|prime minister|election|weather)\b/.test(t)) return 'current';
  if (/\b(compare|versus| vs |difference between|pros and cons|which is better)\b/.test(t)) return 'compare';
  if (/\b(what is|define|definition|science|biology|chemical|physics|chemistry|human body|plant|cell|disease|water cycle|how does|why does)\b/.test(t)) return 'science';
  return 'general';
}

const STOP = new Set('a an the of in on at to for from by with and or is are was were be been what who whom whose which when where why how do does did can could should would will about into over under it its this that these those i you he she we they me my your our their as not no yes tell explain please define describe give show'.split(' '));
export const keywords = (q) => q.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((x) => x.length > 1 && !STOP.has(x));

export function followUps(query, topic, lang = 'en') {
  const hi = lang === 'hi';
  let q = query.replace(/[,.]?\s*\b(and |also |please )?(show|give|find|get) me\b.*$/i, '').replace(/\s+(with|and) (a |some )?(videos?|images?|pictures?|photos?|diagrams?)\b.*$/i, '').trim();
  const noun = /^(what is|what are|what was|who is|who was|explain|tell me about|define|describe)\s+/i.test(q) || q.split(/\s+/).length <= 3;
  q = q.replace(/^(what is|what are|what was|who is|who was|explain|tell me about|define|describe)\s+(a |an |the )?/i, '').replace(/[?.!]+$/, '').trim() || query;
  if (!noun || q.length > 70) { // full-sentence questions: generic, subject-free follow-ups
    return hi ? ['इसे और आसान भाषा में समझाइए', 'एक वास्तविक उदाहरण दीजिए', 'मुख्य बातें बुलेट में बताइए'] : ["Explain that in simpler terms", 'Give a real-life example', 'Summarize the key points'];
  }
  const base = {
    science: hi ? [`${q} का उदाहरण दीजिए`, `${q} को आसान भाषा में समझाइए`, `${q} पर क्विज़ बनाइए`] : [`Give a real-life example of ${q}`, `Explain ${q} like I'm 12`, `Quiz me on ${q}`],
    math: hi ? ['इसे चरण-दर-चरण हल कीजिए', 'एक और अभ्यास प्रश्न दीजिए'] : ['Solve it step by step', 'Give me a similar practice problem'],
    history: hi ? [`${q} के मुख्य कारण क्या थे?`, `${q} की समयरेखा दीजिए`] : [`What were the main causes of ${q}?`, `Give a timeline for ${q}`],
    code: hi ? ['एक उदाहरण कोड दिखाइए', 'इसे और बेहतर कैसे करें?'] : ['Show an example', 'How can this be improved?'],
    compare: hi ? ['तालिका में तुलना कीजिए', 'कौन-सा कब चुनें?'] : ['Put this in a comparison table', 'When should I choose each?'],
    current: hi ? ['नवीनतम स्रोत दिखाइए'] : ['Show me the most recent sources'],
    general: hi ? [`${q} को सरल शब्दों में समझाइए`, `${q} के बारे में मुख्य बातें`] : [`Summarize ${q} in 5 bullet points`, `What are common misconceptions about ${q}?`],
  };
  return (base[topic] || base.general).slice(0, 3);
}

/** Creative / conversational / transformation requests don't need a knowledge lookup — answer them directly like an assistant. */
export function needsKnowledge(q) {
  const t = q.trim();
  if (/^(write|compose|draft|create|generate|make|rewrite|rephrase|paraphrase|translate|proofread|improve|edit|fix|brainstorm|suggest|give me (some )?(ideas|names)|tell me a (joke|story|riddle)|pretend|roleplay|act as|imagine|continue|summari[sz]e|shorten|expand)\b/i.test(t) && !/\b(research|sources?|latest|news|statistics|data on)\b/i.test(t)) return false;
  if (/^(how are you|who are you|what are you|what can you do|what('| i)?s your name|are you (an? )?(ai|bot|human|real)|help|can you help)/i.test(t)) return false;
  if (/^(ok|okay|cool|nice|great|good|wow|hmm+|lol|yes|no|sure|fine|got it|i see)[!. ]*$/i.test(t)) return false;
  return true;
}

export function selfIntro(q) {
  const t = q.trim();
  if (/^(who are you|what are you|what('| i)?s your name|are you (an? )?(ai|bot|human|real))\b/i.test(t)) return "I'm **Nova** — a free, open-source AI assistant. I can explain topics, answer questions with cited sources from dozens of free knowledge databases, solve maths, check weather and currency rates, write and edit text, and help with code. Nothing you ask requires an account or a paid plan.";
  if (/^(what can you do|help|can you help)/i.test(t)) return "Here's what I can do:\n\n- **Explain & research** — science, history, health, tech, with numbered sources\n- **Calculate & convert** — maths, percentages, currencies\n- **Live info** — weather, country facts, definitions\n- **Write & edit** — emails, summaries, rewrites, translations *(needs an AI mode in Settings)*\n- **Code help** — explain errors, show examples\n\nJust ask in plain language, in any of 14 languages.";
  if (/^how are you/i.test(t)) return "Doing great, thanks for asking! What would you like to explore?";
  return null;
}

/** Make short follow-ups ("and its capital?") searchable by borrowing the previous question's subject. */
export function contextualize(q, history = []) {
  const words = q.trim().split(/\s+/);
  if (words.length > 6 || !/\b(it|its|this|that|these|those|they|them|their|he|she|him|her|more|also|and|then|why|how)\b/i.test(q)) return q;
  const prev = [...history].reverse().find((m) => m.role === 'user' && m.text);
  return prev ? `${prev.text.replace(/[?.!]+$/, '')} ${q}` : q;
}
