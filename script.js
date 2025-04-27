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


// --- Service Worker Registration ---
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // Register service worker from the root, scope is the whole origin
    navigator.serviceWorker.register('/service-worker.js', { scope: '/' }) // CORRECTED PATH & SCOPE
      .then(registration => {
        console.log('Service Worker registered successfully with scope:', registration.scope);
      })
      .catch(error => {
        console.error('Service Worker registration failed:', error); // This will now hopefully succeed
      });
  });
} else {
  console.log('Service Worker is not supported by this browser.');
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
        { name: 'Japanese', code: 'japanese', flagCode: 'jp', speakers: 128 },
        { name: 'Kannada', code: 'kannada', flagCode: 'kn', speakers: 56 }
        // Add more languages here
      ]
    }; // End of return object for data()
  }, // End of data() function

  // --- Computed Properties ---
  computed: {
    // Get the current lesson object based on selectedLessonId
    currentLesson() {
      // Keep this existing computed property
      if (!this.selectedLessonId || !this.lessons || this.lessons.length === 0) return null;
      return this.lessons.find(lesson => lesson.id === this.selectedLessonId) || null;
    },

    // *** START: NEW COMPUTED PROPERTIES FOR NAVIGATION ***
    // Find the index of the current lesson
    currentLessonIndex() {
      if (!this.selectedLessonId || !this.lessons || this.lessons.length === 0) {
        return -1;
      }
      return this.lessons.findIndex(lesson => lesson.id === this.selectedLessonId);
    },

    // Get the previous lesson object
    previousLesson() {
      if (this.currentLessonIndex > 0) {
        return this.lessons[this.currentLessonIndex - 1];
      }
      return null;
    },

    // Get the next lesson object
    nextLesson() {
      if (this.currentLessonIndex >= 0 && this.currentLessonIndex < this.lessons.length - 1) {
        return this.lessons[this.currentLessonIndex + 1];
      }
      return null;
    }
    // *** END: NEW COMPUTED PROPERTIES FOR NAVIGATION ***

  }, // End of computed

  // --- Lifecycle Hooks ---
  created() {
    // Check for saved theme preference
    const savedTheme = localStorage.getItem('theme');
    // --- MODIFIED: Get the meta tag ---
    const themeMetaTag = document.querySelector('meta[name="theme-color"]');

    if (savedTheme === 'dark') {
      this.darkTheme = true;
      document.body.classList.add('dark-theme');
      // --- MODIFIED: Set initial dark theme color ---
      if (themeMetaTag) {
        themeMetaTag.setAttribute('content', '#1a1a1a');
      }
    } else {
      this.darkTheme = false;
      document.body.classList.remove('dark-theme');
      // --- MODIFIED: Set initial light theme color ---
      if (themeMetaTag) {
        themeMetaTag.setAttribute('content', '#ffffff');
      }
      // Ensure light theme is default if no setting or invalid setting
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

      // --- MODIFIED: Update meta tag ---
      const themeMetaTag = document.querySelector('meta[name="theme-color"]');
      if (themeMetaTag) {
        // --- MODIFIED: Use background colors ---
        const newThemeColor = this.darkTheme ? '#1a1a1a' : '#ffffff';
        themeMetaTag.setAttribute('content', newThemeColor);
      }
      // --- End of modification ---
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
        }, 300); // Short delay for visual feedback
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
        // IMPORTANT: Adjust this path if your files are located elsewhere
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
            this.selectedLessonId = this.lessons[0].id; // Select the first lesson
            this.selectLesson(); // Render the first lesson (will also scroll)
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
        this.currentView = 'lesson-selector'; // Stay on lesson view to show error
      } finally {
        this.loading = false;
      }
    },

    splitIntoLessons(markdown, languageCode) {
      const lessons = [];
      if (!markdown) return lessons;

      // Split by H2 headings (##), keeping the heading with the content
      const sections = markdown.split(/(?=^##\s)/gm);
      let lessonIndex = 1;
      let introContent = '';

      sections.forEach((section, index) => {
        section = section.trim();
        if (!section) return;

        // If the first chunk doesn't start with ##, treat it as intro
        if (index === 0 && !section.startsWith('## ')) {
          introContent = section;
          if (introContent) {
            // Try to extract H1 title if present, otherwise default
            const introTitleMatch = introContent.match(/^#\s+(.*)/);
            const introTitle = introTitleMatch ? introTitleMatch[1].trim() : 'Introduction';
            lessons.push({
              id: `${languageCode}-intro`,
              title: introTitle,
              content: introContent // Keep the H1 in the content for rendering
            });
          }
        }
        // Process sections starting with ## as lessons
        else if (section.startsWith('## ')) {
          const lines = section.split('\n');
          const title = lines[0].substring(3).trim(); // Get text after '## '
          const content = section; // Content includes the '## Title' line
          lessons.push({
            id: `${languageCode}-lesson-${lessonIndex}`,
            title: title,
            content: content
          });
          lessonIndex++;
        }
        // Handle edge case where the *very first* section IS a lesson (starts with ##)
        else if (index === 0 && section.startsWith('## ')) {
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

    // Method to load the selected lesson's content
    selectLesson() {
      if (this.selectedLessonId && this.lessons.length > 0) {
        const lesson = this.lessons.find(l => l.id === this.selectedLessonId);
        if (lesson) {
          this.renderMarkdown(lesson.content);
          // Use $nextTick to ensure the DOM is updated before scrolling
          this.$nextTick(() => this.scrollToContentTop());
        } else {
          console.warn("Selected lesson ID not found:", this.selectedLessonId);
          this.lessonContent = '<p>Error: Could not find the selected lesson.</p>'; // Display error inline
          this.errorMessage = ''; // Clear global error message
        }
      }
    },

    // *** START: NEW NAVIGATION METHODS ***
    goToPreviousLesson() {
      if (this.previousLesson) {
        this.selectedLessonId = this.previousLesson.id;
        this.selectLesson(); // Re-use existing method to load content and scroll
      }
    },

    goToNextLesson() {
      if (this.nextLesson) {
        this.selectedLessonId = this.nextLesson.id;
        this.selectLesson(); // Re-use existing method to load content and scroll
      }
    },
    // *** END: NEW NAVIGATION METHODS ***

    // Render Markdown to HTML
    renderMarkdown(markdown) {
      if (typeof marked === 'undefined') {
        console.error("marked.js library is not loaded.");
        this.errorMessage = "Error: Markdown parser not available.";
        this.errorTitle = "Display Error";
        this.lessonContent = null;
        return;
      }
      if (!markdown) {
        this.lessonContent = ''; // Handle empty markdown case
        return;
      }

      try {
        // 1. Remove the main H1/H2 title from the content before rendering
        //    (it's already displayed in the header/modal/buttons)
        let processedMarkdown = markdown
          .replace(/^#\s+.*/, '')   // Remove H1 if it was part of intro
          .replace(/^##\s+.*/, '')  // Remove H2 if it was part of a lesson
          .trim();

        // 2. Parse the remaining Markdown
        let html = marked.parse(processedMarkdown);

        // 3. Post-process HTML (Table Containers, Thinking Points, Practice Answers)
        // Wrap tables
        html = html.replace(/<table([\s\S]*?)>/g, '<div class="table-container"><table$1>');
        html = html.replace(/<\/table>/g, '</table></div>');

        // Transform Thinking Point blockquotes
        html = html.replace(
          /<blockquote>\s*<p>\s*<strong>Thinking Point:?(.*?)<\/strong>([\s\S]*?)<\/p>\s*<\/blockquote>/gi,
          (match, title, content) => {
            const trimmedTitle = title ? title.trim() : '';
            // Need to handle potential paragraphs within the blockquote content
            let formattedContent = content.trim().replace(/<\/?p>/g, ''); // Basic removal of inner <p> tags
            return `<div class="thinking-point"><div class="thinking-header">Thinking Point${trimmedTitle ? ': ' + trimmedTitle : ''}</div><div>${formattedContent}</div></div>`;
          }
        );

        // Transform Practice Answers sections
        const practiceStartMarker = '<p><em><strong>Practice Answers:</strong></em></p>';
        let practiceEndMarker = '<hr>'; // Assumes HR separates the answers section
        let startIndex = html.indexOf(practiceStartMarker);

        while (startIndex !== -1) {
          const replacementStart = '<div class="practice-answers"><h4>Practice Answers</h4>'; // Simple title
          // Remove the original marker and insert the new div start
          html = html.substring(0, startIndex) + replacementStart + html.substring(startIndex + practiceStartMarker.length);

          // Find the *next* <hr> tag after the inserted div start
          let endIndex = html.indexOf(practiceEndMarker, startIndex + replacementStart.length);

          if (endIndex !== -1) {
            // Replace the <hr> with the closing div tag
            html = html.substring(0, endIndex) + '</div>' + html.substring(endIndex + practiceEndMarker.length);
          } else {
            // If no <hr> is found after the start marker, close the div at the end of the content
            html += '</div>';
            console.warn("Practice Answers section started but no subsequent <hr> found. Closed at end of content.");
            break; // Exit loop as we can't find more markers reliably
          }

          // Look for the next start marker *after* the section we just processed
          startIndex = html.indexOf(practiceStartMarker, startIndex + replacementStart.length); // Corrected search position
        }


        // Set the final processed HTML
        this.lessonContent = html;
        this.errorMessage = ''; // Clear any previous errors
        this.comingSoon = false; // Ensure coming soon is false

      } catch (error) {
        console.error("Error rendering Markdown:", error);
        this.errorMessage = "Sorry, we couldn't display the lesson content correctly.";
        this.errorTitle = "Display Error";
        this.errorDetails = error.message;
        this.lessonContent = null; // Clear content on error
      }
    },

    // --- UI Helpers ---
    renderComingSoon() {
      this.comingSoon = true;
      this.lessonContent = null;
      this.lessons = [];
      this.selectedLessonId = '';
      this.errorMessage = '';
      this.currentView = 'lesson-selector'; // Stay on view to show message
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
      // Don't change currentView here automatically
    },

    // Format lesson titles (remove "Lesson X:" prefix)
    formatLessonTitle(title) {
      if (!title) return '';
      // Remove prefixes like "Lesson 1:", "1:", "Introduction:", etc.
      return title.replace(/^(Lesson\s+\d+:?|Intro(?:duction)?:?|\d+:?)\s*/i, '').trim();
    },


    handleScroll() {
      this.showScrollTop = window.pageYOffset > 300;
    },

    scrollToTop() {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    // Scroll to the top of the lesson content area
    // *** UPDATED scrollToContentTop ***
    scrollToContentTop() {
      // Use document.querySelector
      const contentArea = document.querySelector('.content');
      if (contentArea) {
        const header = document.querySelector('header');
        const floatingHeader = document.querySelector('.floating-lesson-header');
        const headerHeight = header ? header.offsetHeight : 0;
        // Get height of floating header ONLY if it's actually displayed
        const floatingHeaderHeight = (floatingHeader && this.lessonContent && !this.loading && this.currentView === 'lesson-selector') ? floatingHeader.offsetHeight : 0;
        const topPadding = 20; // Extra space above content

        const offset = headerHeight + floatingHeaderHeight + topPadding;

        // Get the top position of the content area WRAPPER (which contains the content)
        const contentWrapper = document.querySelector('.lesson-content-wrapper');
        // If wrapper exists, scroll to it, otherwise fallback to the main content area
        const elementToScrollTo = contentWrapper || contentArea;

        // Calculate the absolute top position of the element relative to the document
        const elementTop = elementToScrollTo.getBoundingClientRect().top + window.pageYOffset;

        // Calculate the final scroll position
        const scrollToPosition = elementTop - offset;


        window.scrollTo({
          top: scrollToPosition < 0 ? 0 : scrollToPosition, // Prevent scrolling above 0
          behavior: 'smooth'
        });
      }
    } // End of scrollToContentTop
  } // End of methods
}); // End of Vue.createApp({})

// --- Mount the Application ---
app.mount('#app');