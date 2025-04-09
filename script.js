// Initialize marked.js renderer and options globally
if (typeof marked !== 'undefined') {
  marked.setOptions({
    renderer: new marked.Renderer(),
    highlight: null, // No syntax highlighting by default
    pedantic: false,
    gfm: true,    // Use GitHub Flavored Markdown
    breaks: true,   // Convert single line breaks to <br>
    sanitize: false, // IMPORTANT: Only use false if Markdown source is trusted
    smartLists: true,
    smartypants: false,
    xhtml: false
  });
} else {
  console.error("Marked.js library not loaded!");
}

// --- Vue 3 Application Initialization ---
const app = Vue.createApp({
  // --- Data Option (now a function) ---
  data() {
    return {
      // App state
      currentView: 'hero', // 'hero', 'language-grid', 'lesson-selector'
      loading: false,
      darkTheme: false,
      showHeaderLanguageDropdown: false,
      showLessonModal: false,
      showScrollTop: false,

      // Content
      selectedLanguage: null, // { name, code, flagCode, speakers }
      selectedLessonId: '',   // e.g., 'german-lesson-1'
      lessonContent: null,    // HTML content of the current lesson

      // Error handling
      errorMessage: '',
      errorTitle: 'Oops! Something went wrong.',
      errorDetails: '',

      // Placeholder content
      placeholderIcon: 'fas fa-book-open',
      placeholderTitle: 'Welcome to LingoMitra!',
      placeholderText: 'Your journey to mastering new languages begins here. Select a language to get started.',

      // Data
      lessons: [], // Array of { id, title, content }
      comingSoon: false,
      currentYear: new Date().getFullYear(),

      // Available languages
      languages: [
        { name: 'German', code: 'german', flagCode: 'de', speakers: 132 },
        { name: 'Spanish', code: 'spanish', flagCode: 'es', speakers: 534 },
        { name: 'French', code: 'french', flagCode: 'fr', speakers: 280 },
        { name: 'Hindi', code: 'hindi', flagCode: 'hi', speakers: 615 },
        { name: 'Chinese', code: 'chinese', flagCode: 'zh', speakers: 1120 },
        { name: 'Japanese', code: 'japanese', flagCode: 'jp', speakers: 128 }
        // Add more languages here
      ]
    }; // End of return object for data()
  }, // End of data() function

  // --- Computed Properties ---
  computed: {
    // Get the current lesson object based on selectedLessonId
    currentLesson() {
      if (!this.selectedLessonId || !this.lessons || this.lessons.length === 0) return null;
      return this.lessons.find(lesson => lesson.id === this.selectedLessonId) || null;
    }
  }, // End of computed

  // --- Lifecycle Hooks ---
  created() {
    // Check for saved theme preference
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
      this.darkTheme = true;
      document.body.classList.add('dark-theme');
    } else {
      // Ensure light theme is default if no setting or invalid setting
      this.darkTheme = false;
      document.body.classList.remove('dark-theme');
      localStorage.setItem('theme', 'light');
    }

    // Check if user has visited before to potentially skip hero
    const hasVisitedBefore = localStorage.getItem('hasVisited');
    if (hasVisitedBefore === 'true') {
      this.currentView = 'language-grid';
      // Reset placeholder for returning users who haven't selected a language yet
      this.placeholderTitle = 'Choose Your Language';
      this.placeholderText = 'Select a language from the grid to start learning.';
      this.placeholderIcon = 'fas fa-language';
    } else {
      // Set initial placeholder text for first-time visitors
      this.placeholderTitle = 'Welcome to LingoMitra!';
      this.placeholderText = 'Your journey to mastering new languages begins here. Click "Get Started" above or choose a language below.';
      this.placeholderIcon = 'fas fa-book-open';
    }


    // Add global event listeners
    // Note: In Vue 3 Options API, 'this' still correctly refers to the component instance
    document.addEventListener('click', this.handleOutsideClick);
    window.addEventListener('scroll', this.handleScroll);
    document.addEventListener('keydown', this.handleKeyDown);
  },

  // Renamed from beforeDestroy
  beforeUnmount() {
    // Clean up global event listeners
    document.removeEventListener('click', this.handleOutsideClick);
    window.removeEventListener('scroll', this.handleScroll);
    document.removeEventListener('keydown', this.handleKeyDown);
  },

  // --- Methods ---
  methods: {
    // --- Theme Handling ---
    toggleTheme() {
      this.darkTheme = !this.darkTheme;
      document.body.classList.toggle('dark-theme');
      localStorage.setItem('theme', this.darkTheme ? 'dark' : 'light');
    },

    // --- Navigation ---
    goToLanguageSelection() {
      this.currentView = 'language-grid';
      this.resetLessonState(); // Clear language/lesson specific data
      this.showHeaderLanguageDropdown = false; // Ensure dropdown is closed

      // Mark user as having visited (for skipping hero next time)
      localStorage.setItem('hasVisited', 'true');

      // Optionally scroll to the top of the language grid section
      // $nextTick is still available
      this.$nextTick(() => {
        // Use document.querySelector as $el might not be reliable in the same way or needed
        const gridSection = document.querySelector('.language-grid-section');
        if (gridSection) {
          gridSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      });
    },

    // --- Dropdown Handling ---
    toggleHeaderLanguageDropdown() {
      this.showHeaderLanguageDropdown = !this.showHeaderLanguageDropdown;
    },

    // --- Get Lesson Number ---
    getLessonNumber(lessonId) {
      if (!lessonId || typeof lessonId !== 'string') return null; // Basic validation
      if (lessonId.includes('-lesson-')) {
        const parts = lessonId.split('-lesson-');
        return parts.length > 1 && !isNaN(parts[1]) ? parts[1] : null;
      }
      return null;
    },

    handleOutsideClick(event) {
      // In Vue 3, accessing DOM elements directly might be discouraged in favor of refs,
      // but for this simple case targeting document elements might be okay.
      // However, using document.querySelector is safer than relying on this.$el within a global listener.
      const headerDropdown = document.querySelector('.language-dropdown');
      if (this.showHeaderLanguageDropdown && headerDropdown && !headerDropdown.contains(event.target)) {
        this.showHeaderLanguageDropdown = false;
      }
      const modalOverlay = document.querySelector('.modal-overlay');
      // Check if the modal is actually shown in the data property
      if (this.showLessonModal && event.target === modalOverlay) {
        this.closeLessonModal();
      }
    },


    // --- Lesson Modal Handling ---
    openLessonModal() {
      this.showLessonModal = true;
      document.body.classList.add('modal-open');
      this.$nextTick(() => {
        // Use document.querySelector
        const modal = document.querySelector('.lesson-selection-modal');
        const overlay = document.querySelector('.modal-overlay');
        if (modal) modal.classList.add('show');
        if (overlay) overlay.classList.add('show');
      });
    },

    closeLessonModal() {
      // Use document.querySelector
      const modal = document.querySelector('.lesson-selection-modal');
      const overlay = document.querySelector('.modal-overlay');
      if (modal) modal.classList.remove('show');
      if (overlay) overlay.classList.remove('show');

      setTimeout(() => {
        this.showLessonModal = false;
        document.body.classList.remove('modal-open');
      }, 300);
    },


    selectLessonFromModal(lessonId) {
      if (lessonId === this.selectedLessonId) {
        this.closeLessonModal();
        return;
      }
      this.selectedLessonId = lessonId;
      this.selectLesson();
      this.closeLessonModal();
    },

    // --- Keyboard Handling ---
    handleKeyDown(event) {
      if (event.key === 'Escape' && this.showLessonModal) {
        this.closeLessonModal();
      }
    },

    // --- Language & Lesson Loading ---
    selectLanguage(language) {
      if (this.selectedLanguage && this.selectedLanguage.code === language.code && this.currentView === 'lesson-selector') {
        this.showHeaderLanguageDropdown = false;
        return;
      }

      this.selectedLanguage = language;
      this.showHeaderLanguageDropdown = false;

      if (language) {
        this.loading = true;
        this.resetLessonState(false);
        setTimeout(() => {
          this.fetchLanguageContent(language.code);
        }, 300);
      } else {
        this.goToLanguageSelection();
      }
    },

    async fetchLanguageContent(languageCode) {
      this.loading = true;
      this.errorMessage = '';
      this.errorDetails = '';
      this.comingSoon = false;

      try {
        const fileName = `./courses/${languageCode}-lesson.md`;
        const response = await fetch(fileName);

        if (!response.ok) {
          if (response.status === 404) {
            console.warn(`Lesson file not found: ${fileName}`);
            this.renderComingSoon();
          } else {
            throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
          }
        } else {
          const markdown = await response.text();
          this.lessons = this.splitIntoLessons(markdown, languageCode);

          if (this.lessons && this.lessons.length > 0) {
            this.currentView = 'lesson-selector';
            this.selectedLessonId = this.lessons[0].id;
            this.renderMarkdown(this.lessons[0].content);
            this.$nextTick(() => this.scrollToContentTop());
          } else {
            console.warn(`No lessons found in file: ${fileName}`);
            this.renderComingSoon();
          }
        }
      } catch (error) {
        console.error('Error loading or processing lesson:', error);
        this.errorMessage = 'Sorry, we couldn\'t load the lessons for this language.';
        this.errorTitle = 'Failed to Load Lessons';
        this.errorDetails = error.message;
        this.resetLessonState();
        this.currentView = 'lesson-selector';
      } finally {
        this.loading = false;
      }
    },

    splitIntoLessons(markdown, languageCode) {
      const lessons = [];
      if (!markdown) return lessons;
      const sections = markdown.split(/(?=^##\s)/gm);
      let introContent = '';
      let lessonIndex = 1;

      sections.forEach((section, index) => {
        section = section.trim();
        if (!section) return;

        if (index === 0 && !section.startsWith('## ')) {
          introContent = section;
          if (introContent) {
            lessons.push({
              id: `${languageCode}-intro`,
              title: (introContent.match(/^#\s+(.*)/)?.[1] || 'Introduction').trim(),
              content: introContent
            });
          }
        } else if (section.startsWith('## ')) {
          const lines = section.split('\n');
          const title = lines[0].substring(3).trim();
          const content = section;
          lessons.push({
            id: `${languageCode}-lesson-${lessonIndex}`,
            title: title,
            content: content
          });
          lessonIndex++;
        } else if (index === 0 && section.startsWith('## ')) {
          // Handle case where first section IS a lesson
          const lines = section.split('\n');
          const title = lines[0].substring(3).trim();
          const content = section;
          lessons.push({
            id: `${languageCode}-lesson-${lessonIndex}`,
            title: title,
            content: content
          });
          lessonIndex++;
        }
      });
      return lessons;
    },


    selectLesson() {
      if (this.selectedLessonId && this.lessons.length > 0) {
        const lesson = this.lessons.find(l => l.id === this.selectedLessonId);
        if (lesson) {
          this.renderMarkdown(lesson.content);
          this.$nextTick(() => this.scrollToContentTop());
        } else {
          console.warn("Selected lesson ID not found:", this.selectedLessonId);
          this.lessonContent = '<p>Error: Could not find the selected lesson.</p>';
        }
      }
    },

    renderMarkdown(markdown) {
      if (typeof marked === 'undefined') {
        console.error("marked.js library is not loaded.");
        this.errorMessage = "Error: Markdown parser not available.";
        this.errorTitle = "Display Error";
        this.lessonContent = null;
        return;
      }
      if (!markdown) {
        this.lessonContent = '';
        return;
      }

      try {
        let processedMarkdown = markdown.replace(/^##\s+(?:Lesson\s+)?\d+:\s*/, '').trim();
        let html = marked.parse(processedMarkdown);

        // Post-processing HTML
        html = html.replace(/<table([\s\S]*?)>/g, '<div class="table-container"><table$1>');
        html = html.replace(/<\/table>/g, '</table></div>');

        html = html.replace(
          /<blockquote>\s*<p>\s*<strong>Thinking Point:?(.*?)<\/strong>([\s\S]*?)<\/p>\s*<\/blockquote>/gi,
          (match, title, content) => {
            const trimmedTitle = title ? title.trim() : '';
            let formattedContent = content.trim();
            return `<div class="thinking-point"><div class="thinking-header">Thinking Point${trimmedTitle ? ': ' + trimmedTitle : ''}</div><div>${formattedContent}</div></div>`;
          }
        );

        const practiceStartMarker = '<p><em><strong>Practice Answers:</strong></em></p>';
        let practiceEndMarker = '<hr>';
        let startIndex = html.indexOf(practiceStartMarker);
        while (startIndex !== -1) {
          const replacementStart = '<div class="practice-answers"><h4>Practice Answers:</h4>';
          html = html.substring(0, startIndex) + replacementStart + html.substring(startIndex + practiceStartMarker.length);
          let endIndex = html.indexOf(practiceEndMarker, startIndex + replacementStart.length);
          if (endIndex !== -1) {
            html = html.substring(0, endIndex) + '</div>' + html.substring(endIndex);
          } else {
            html += '</div>';
            console.warn("Practice Answers section started but no subsequent <hr> found. Closed at end of content.");
            break;
          }
          startIndex = html.indexOf(practiceStartMarker, startIndex + replacementStart.length + '</div>'.length + practiceEndMarker.length);
        }

        this.lessonContent = html;
        this.errorMessage = '';
        this.comingSoon = false;

      } catch (error) {
        console.error("Error rendering Markdown:", error);
        this.errorMessage = "Sorry, we couldn't display the lesson content correctly.";
        this.errorTitle = "Display Error";
        this.errorDetails = error.message;
        this.lessonContent = null;
      }
    },

    // --- UI Helpers ---
    renderComingSoon() {
      this.comingSoon = true;
      this.lessonContent = null;
      this.lessons = [];
      this.selectedLessonId = '';
      this.errorMessage = '';
      this.currentView = 'lesson-selector';
    },

    resetLessonState(resetLanguage = true) {
      if (resetLanguage) {
        this.selectedLanguage = null;
      }
      this.lessons = [];
      this.selectedLessonId = '';
      this.lessonContent = null;
      this.errorMessage = '';
      this.errorDetails = '';
      this.comingSoon = false;
    },

    formatLessonTitle(title) {
      if (!title) return '';
      return title.replace(/^Lesson\s+\d+:\s*|^(\d+):\s*/i, '').trim();
    },


    handleScroll() {
      this.showScrollTop = window.pageYOffset > 300;
    },

    scrollToTop() {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    scrollToContentTop() {
      // Use document.querySelector
      const contentArea = document.querySelector('.content');
      if (contentArea) {
        const headerHeight = document.querySelector('header')?.offsetHeight || 0;
        const floatingHeaderHeight = document.querySelector('.floating-lesson-header .container')?.offsetHeight || 0; // Target container for height
        const floatingHeaderMarginTop = 20; // The margin-top we added in CSS
        const offset = headerHeight + floatingHeaderHeight + floatingHeaderMarginTop + 20; // Add extra padding

        // Get the top position of the content area relative to the viewport
        const contentTop = contentArea.getBoundingClientRect().top;
        // Calculate the absolute position to scroll to
        const absoluteScrollPosition = window.pageYOffset + contentTop - offset;


        window.scrollTo({
          top: absoluteScrollPosition,
          behavior: 'smooth'
        });
      }
    } // End of scrollToContentTop
  } // End of methods
}); // End of Vue.createApp({})

// --- Mount the Application ---
app.mount('#app');