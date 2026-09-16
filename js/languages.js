/* One catalogue for navigation, course assets and browser speech locales.
   Slugs are stable because existing bookmarks and progress use them. */
(function (root, factory) {
  var catalogue = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = catalogue;
  else root.languageCatalog = catalogue;
})(typeof window !== 'undefined' ? window : this, function () {
  'use strict';
  var entries = [
    ['german', 'German', 'Deutsch', 'de', ['de-DE', 'de-AT', 'de-CH', 'de'], 'ltr', 'existing'],
    ['spanish', 'Spanish', 'Español', 'es', ['es-ES', 'es-MX', 'es-US', 'es-419', 'es'], 'ltr', 'existing'],
    ['french', 'French', 'Français', 'fr', ['fr-FR', 'fr-CA', 'fr-BE', 'fr'], 'ltr', 'existing'],
    ['hindi', 'Hindi', 'हिन्दी', 'hi', ['hi-IN', 'hi'], 'ltr', 'existing'],
    ['chinese', 'Chinese', '中文', 'zh', ['zh-CN', 'cmn-Hans-CN', 'zh-Hans', 'zh'], 'ltr', 'existing'],
    ['japanese', 'Japanese', '日本語', 'jp', ['ja-JP', 'ja'], 'ltr', 'existing'],
    ['kannada', 'Kannada', 'ಕನ್ನಡ', 'kn', ['kn-IN', 'kn'], 'ltr', 'existing'],
    ['assamese', 'Assamese', 'অসমীয়া', 'hi', ['as-IN', 'as']],
    ['bengali', 'Bengali', 'বাংলা', 'hi', ['bn-IN', 'bn-BD', 'bn']],
    ['bodo', 'Bodo', 'बड़ो', 'hi', ['brx-IN', 'brx']],
    ['dogri', 'Dogri', 'डोगरी', 'hi', ['doi-IN', 'doi']],
    ['gujarati', 'Gujarati', 'ગુજરાતી', 'hi', ['gu-IN', 'gu']],
    ['kashmiri', 'Kashmiri', 'कॉशुर', 'hi', ['ks-Deva-IN', 'ks-IN', 'ks']],
    ['konkani', 'Konkani', 'कोंकणी', 'hi', ['kok-IN', 'kok']],
    ['maithili', 'Maithili', 'मैथिली', 'hi', ['mai-IN', 'mai']],
    ['malayalam', 'Malayalam', 'മലയാളം', 'hi', ['ml-IN', 'ml']],
    ['manipuri', 'Manipuri (Meiteilon)', 'ꯃꯤꯇꯩꯂꯣꯟ', 'hi', ['mni-Mtei-IN', 'mni-IN', 'mni']],
    ['marathi', 'Marathi', 'मराठी', 'hi', ['mr-IN', 'mr']],
    ['nepali', 'Nepali', 'नेपाली', 'hi', ['ne-NP', 'ne-IN', 'ne']],
    ['odia', 'Odia', 'ଓଡ଼ିଆ', 'hi', ['or-IN', 'or']],
    ['punjabi', 'Punjabi', 'ਪੰਜਾਬੀ', 'hi', ['pa-Guru-IN', 'pa-IN', 'pa']],
    ['sanskrit', 'Sanskrit', 'संस्कृतम्', 'hi', ['sa-IN', 'sa']],
    ['santali', 'Santali', 'ᱥᱟᱱᱛᱟᱲᱤ', 'hi', ['sat-Olck-IN', 'sat-IN', 'sat']],
    ['sindhi', 'Sindhi', 'سنڌي', 'hi', ['sd-Arab', 'sd-PK', 'sd'], 'rtl'],
    ['tamil', 'Tamil', 'தமிழ்', 'hi', ['ta-IN', 'ta-LK', 'ta']],
    ['telugu', 'Telugu', 'తెలుగు', 'hi', ['te-IN', 'te']],
    ['urdu', 'Urdu', 'اردو', 'hi', ['ur-IN', 'ur-PK', 'ur'], 'rtl'],
    ['persian', 'Persian', 'فارسی', 'ir', ['fa-IR', 'fa'], 'rtl'],
    ['russian', 'Russian', 'Русский', 'ru', ['ru-RU', 'ru']],
    ['italian', 'Italian', 'Italiano', 'it', ['it-IT', 'it']],
    ['arabic', 'Arabic (Modern Standard)', 'العربية', 'sa', ['ar-SA', 'ar-EG', 'ar'], 'rtl'],
    ['portuguese', 'Portuguese (Brazil)', 'Português', 'br', ['pt-BR', 'pt']],
    ['korean', 'Korean', '한국어', 'kr', ['ko-KR', 'ko']],
    ['turkish', 'Turkish', 'Türkçe', 'tr', ['tr-TR', 'tr']]
  ];
  var romanCourses = ['bodo', 'kashmiri', 'manipuri', 'santali'];
  return entries.map(function (e) {
    var roman = romanCourses.indexOf(e[0]) >= 0;
    return {
      code: e[0], name: e[1], nativeName: e[2], flagCode: e[3], tags: e[4],
      direction: e[5] || 'ltr', reviewStatus: e[6] || 'draft',
      coursePath: 'courses/' + e[0] + '-lesson.md',
      strictMarks: e[6] !== 'existing',
      optionalStress: e[0] === 'russian',
      significantPunctuation: roman ? ':' : '',
      contentTag: roman ? e[4][0].split('-')[0] + '-Latn' : e[4][0],
      courseFormat: roman ? 'romanised' : 'native',
      formatNote: e[0] === 'santali'
        ? 'Historical Roman foundation. Contemporary usage review and Ol Chiki lessons pending.'
        : roman ? 'Romanised foundation. Native-script lessons pending.' : '',
      group: e[3] === 'hi' || e[0] === 'kannada' ? 'Indian' : 'International'
    };
  });
});
