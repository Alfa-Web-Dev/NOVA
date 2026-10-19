const en = {
  tagline: 'What can I help with?', placeholder: 'Ask Nova anything…', newChat: 'New chat', searchChats: 'Search chats', recent: 'Recent',
  noChats: 'Your conversations will appear here.', noMatch: 'No matching chats.', settings: 'Settings', today: 'Today', yesterday: 'Yesterday', earlier: 'Earlier',
  quick: 'Quick', normal: 'Normal', deep: 'Deep Dive', quickD: 'Short, direct replies', normalD: 'Balanced answers', deepD: 'Detailed, with more sources',
  send: 'Send', stop: 'Stop', copy: 'Copy', copied: 'Copied', regenerate: 'Regenerate', share: 'Share', listen: 'Read aloud', sources: 'Sources', related: 'Continue exploring',
  disclaimer: 'Nova can make mistakes. Verify important information.', offline: 'Offline', install: 'Install app', update: 'Update available — reload', delete: 'Delete',
  searching: 'Gathering knowledge…', thinking: 'Thinking…', loadingModel: 'Loading on-device model…', stopped: 'Stopped.',
  greet: 'Hello! What would you like to explore today?', thanks: "You're welcome! Ask me anything else.", hello: 'Hello',
  voiceNo: 'Voice typing is not supported in this browser.', voiceFail: 'Could not hear that. Please try again.',
  suggest1: 'Explain photosynthesis simply', suggest2: 'Weather in Mumbai', suggest3: 'Compare solar vs wind energy', suggest4: 'Latest research on sleep and memory', suggest5: 'Explain how a binary search works in JavaScript',
  cardExplore: 'Explore a new topic', cardExploreD: 'Get a clear, thoughtful overview', cardUnderstand: 'Help me understand', cardUnderstandD: 'Break a difficult idea into steps', cardStudy: 'Study smarter', cardStudyD: 'Make notes, examples and quizzes', cardBuild: 'Build something', cardBuildD: 'Plan a project or work through code', sourcesUsed: 'Sources', videosH: 'Videos',
  openOriginal: 'Open original', images: 'Images', videos: 'Find videos', copiedMsg: 'Copied to clipboard', exported: 'Backup exported', imported: 'Backup imported', badBackup: 'Could not read that backup file',
  cleared: 'All chats deleted', confirmClear: 'Delete all chats on this device? This cannot be undone.', exportMd: 'Export chat (Markdown)',
};
const hi = {
  ...en, tagline: 'मैं किसमें मदद करूँ?', placeholder: 'नोवा से कुछ भी पूछें…', newChat: 'नई चैट', searchChats: 'चैट खोजें', recent: 'हाल की', noChats: 'आपकी बातचीत यहाँ दिखेगी।', noMatch: 'कोई चैट नहीं मिली।',
  settings: 'सेटिंग्स', today: 'आज', yesterday: 'कल', earlier: 'पहले', quick: 'त्वरित', normal: 'सामान्य', deep: 'गहन', quickD: 'छोटे, सीधे उत्तर', normalD: 'संतुलित उत्तर', deepD: 'विस्तृत, अधिक स्रोतों के साथ',
  send: 'भेजें', stop: 'रोकें', copy: 'कॉपी', copied: 'कॉपी हुआ', regenerate: 'फिर से बनाएँ', share: 'शेयर', listen: 'सुनें', sources: 'स्रोत', related: 'आगे जानें',
  disclaimer: 'नोवा से गलती हो सकती है। ज़रूरी जानकारी जाँच लें।', offline: 'ऑफ़लाइन', install: 'ऐप इंस्टॉल करें', update: 'अपडेट उपलब्ध — रीलोड करें', delete: 'हटाएँ',
  searching: 'जानकारी जुटा रहा हूँ…', thinking: 'सोच रहा हूँ…', loadingModel: 'ऑन-डिवाइस मॉडल लोड हो रहा है…', stopped: 'रोका गया।',
  greet: 'नमस्ते! आज आप क्या जानना चाहेंगे?', thanks: 'आपका स्वागत है! कुछ और पूछें।', hello: 'नमस्ते',
  voiceNo: 'इस ब्राउज़र में वॉइस टाइपिंग उपलब्ध नहीं है।', voiceFail: 'सुनाई नहीं दिया। फिर कोशिश करें।',
  suggest1: 'प्रकाश संश्लेषण आसान भाषा में समझाइए', suggest2: 'मुंबई का मौसम', suggest3: 'सौर बनाम पवन ऊर्जा की तुलना', suggest4: 'नींद और याददाश्त पर नया शोध', suggest5: 'जावास्क्रिप्ट में बाइनरी सर्च समझाइए',
  cardExplore: 'नया विषय खोजें', cardExploreD: 'साफ़ और सोचा-समझा अवलोकन', cardUnderstand: 'समझने में मदद करें', cardUnderstandD: 'कठिन विचार को चरणों में बाँटें', cardStudy: 'स्मार्ट पढ़ाई', cardStudyD: 'नोट्स, उदाहरण और क्विज़', cardBuild: 'कुछ बनाएँ', cardBuildD: 'प्रोजेक्ट या कोड पर काम करें', sourcesUsed: 'स्रोत', videosH: 'वीडियो',
  openOriginal: 'मूल खोलें', images: 'चित्र', videos: 'वीडियो खोजें', copiedMsg: 'कॉपी हो गया', exported: 'बैकअप निर्यात हुआ', imported: 'बैकअप आयात हुआ', badBackup: 'बैकअप फ़ाइल पढ़ी नहीं जा सकी',
  cleared: 'सभी चैट हटाई गईं', confirmClear: 'इस डिवाइस की सभी चैट हटाएँ? यह वापस नहीं होगा।', exportMd: 'चैट निर्यात (Markdown)',
};
export const UI_LANGS = { en, hi };
export const makeT = (lang) => (k) => (UI_LANGS[lang] || en)[k] ?? en[k] ?? k;
