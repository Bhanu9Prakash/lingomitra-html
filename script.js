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

// Vue application
new Vue({
  el: '#app',
  data: {
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
  },

  computed: {
    // Get the current lesson object based on selectedLessonId
    currentLesson() {
      if (!this.selectedLessonId || !this.lessons || this.lessons.length === 0) return null;
      return this.lessons.find(lesson => lesson.id === this.selectedLessonId) || null;
    }
  },

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
    document.addEventListener('click', this.handleOutsideClick);
    window.addEventListener('scroll', this.handleScroll);
    document.addEventListener('keydown', this.handleKeyDown);
  },

  beforeDestroy() {
    // Clean up global event listeners
    document.removeEventListener('click', this.handleOutsideClick);
    window.removeEventListener('scroll', this.handleScroll);
    document.removeEventListener('keydown', this.handleKeyDown);
  },

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
      this.$nextTick(() => {
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
      // Check if it's a numbered lesson ID (e.g., 'german-lesson-30')
      if (lessonId.includes('-lesson-')) {
        const parts = lessonId.split('-lesson-');
        // Return the part after '-lesson-' if it exists and is a number
        return parts.length > 1 && !isNaN(parts[1]) ? parts[1] : null;
      }
      // Return null if it's not a numbered lesson ID (like '-intro')
      return null;
    },

    handleOutsideClick(event) {
      // Close header language dropdown if clicked outside
      const headerDropdown = this.$el.querySelector('.language-dropdown'); // Use $el to scope query
      if (this.showHeaderLanguageDropdown && headerDropdown && !headerDropdown.contains(event.target)) {
        this.showHeaderLanguageDropdown = false;
      }
      // Close lesson modal if clicked on the overlay
      const modalOverlay = this.$el.querySelector('.modal-overlay');
      if (this.showLessonModal && event.target === modalOverlay) {
        this.closeLessonModal();
      }
    },

    // --- Lesson Modal Handling ---
    openLessonModal() {
      this.showLessonModal = true;
      document.body.classList.add('modal-open');
      // Add 'show' class for CSS transitions after the element is in the DOM
      this.$nextTick(() => {
        const modal = this.$el.querySelector('.lesson-selection-modal');
        const overlay = this.$el.querySelector('.modal-overlay');
        if (modal) modal.classList.add('show');
        if (overlay) overlay.classList.add('show');
      });
    },

    closeLessonModal() {
      // Remove 'show' class to trigger exit transitions
      const modal = this.$el.querySelector('.lesson-selection-modal');
      const overlay = this.$el.querySelector('.modal-overlay');
      if (modal) modal.classList.remove('show');
      if (overlay) overlay.classList.remove('show');

      // Wait for transitions to finish before removing from DOM and unlocking scroll
      setTimeout(() => {
        this.showLessonModal = false;
        document.body.classList.remove('modal-open');
      }, 300); // Match CSS transition duration
    },


    selectLessonFromModal(lessonId) {
      // Check if the selected lesson is already the current one
      if (lessonId === this.selectedLessonId) {
        this.closeLessonModal(); // Just close modal if same lesson clicked
        return;
      }
      this.selectedLessonId = lessonId;
      this.selectLesson(); // Load the new lesson content
      this.closeLessonModal();
    },

    // --- Keyboard Handling ---
    handleKeyDown(event) {
      // Close modal on Escape key press
      if (event.key === 'Escape' && this.showLessonModal) {
        this.closeLessonModal();
      }
    },

    // --- Language & Lesson Loading ---
    selectLanguage(language) {
      // If the same language is clicked again from the dropdown, do nothing
      if (this.selectedLanguage && this.selectedLanguage.code === language.code && this.currentView === 'lesson-selector') {
        this.showHeaderLanguageDropdown = false; // Close dropdown
        return;
      }

      this.selectedLanguage = language;
      this.showHeaderLanguageDropdown = false; // Close dropdown after selection

      if (language) {
        this.loading = true;
        this.resetLessonState(false); // Reset lesson content but keep language selected

        // Fetch language content asynchronously
        // Use a small delay for visual feedback, can be removed if fetch is fast
        setTimeout(() => {
          this.fetchLanguageContent(language.code);
        }, 300);

      } else {
        // Should not happen with current UI, but good fallback
        this.goToLanguageSelection();
      }
    },

    async fetchLanguageContent(languageCode) {
      this.loading = true; // Ensure loading is true
      this.errorMessage = ''; // Clear previous errors
      this.errorDetails = '';
      this.comingSoon = false;

      try {
        // Construct filename relative to the HTML file's location
        const fileName = `./courses/${languageCode}-lesson.md`; // Consistent naming convention
        const response = await fetch(fileName);

        if (!response.ok) {
          // Handle HTTP errors (e.g., 404 Not Found)
          if (response.status === 404) {
            console.warn(`Lesson file not found: ${fileName}`);
            this.renderComingSoon(); // Show coming soon if file doesn't exist
          } else {
            throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
          }
        } else {
          const markdown = await response.text();

          // Split markdown into lesson objects { id, title, content }
          this.lessons = this.splitIntoLessons(markdown, languageCode);

          if (this.lessons && this.lessons.length > 0) {
            // Store lessons (optional, consider if needed for offline/persistence)
            // localStorage.setItem(`lessons_${languageCode}`, JSON.stringify(this.lessons));

            this.currentView = 'lesson-selector'; // Switch view

            // Select the first lesson by default
            this.selectedLessonId = this.lessons[0].id;
            this.renderMarkdown(this.lessons[0].content);

            // Scroll to the top of the content area after loading
            this.$nextTick(() => this.scrollToContentTop());

          } else {
            // Handle case where file exists but has no valid lessons (e.g., empty or wrong format)
            console.warn(`No lessons found in file: ${fileName}`);
            this.renderComingSoon();
          }
        }

      } catch (error) {
        console.error('Error loading or processing lesson:', error);
        this.errorMessage = 'Sorry, we couldn\'t load the lessons for this language.';
        this.errorTitle = 'Failed to Load Lessons';
        this.errorDetails = error.message; // Provide specific error details
        this.resetLessonState(); // Reset fully on critical error
        this.currentView = 'lesson-selector'; // Stay on lesson view to show error
      } finally {
        this.loading = false; // Turn off loading indicator regardless of outcome
      }
    },

    splitIntoLessons(markdown, languageCode) {
      const lessons = [];
      if (!markdown) return lessons;

      // Split the markdown content by '## ' which marks the start of a new lesson heading.
      // The /gm flags ensure it works across multiple lines and globally.
      // We keep the delimiter '## ' as part of the *next* section using a positive lookahead.
      const sections = markdown.split(/(?=^##\s)/gm);

      let introContent = '';
      let lessonIndex = 1; // Start lesson numbering from 1

      sections.forEach((section, index) => {
        section = section.trim();
        if (!section) return; // Skip empty sections

        if (index === 0 && !section.startsWith('## ')) {
          // If the first section doesn't start with '## ', treat it as the introduction.
          introContent = section;
          // Add intro only if it has content
          if (introContent) {
            lessons.push({
              id: `${languageCode}-intro`,
              // Try to find a H1 title for the intro, otherwise use default
              title: (introContent.match(/^#\s+(.*)/)?.[1] || 'Introduction').trim(),
              content: introContent
            });
          }
        } else if (section.startsWith('## ')) {
          // This section is a lesson
          const lines = section.split('\n');
          const title = lines[0].substring(3).trim(); // Get title from '## Title'
          const content = section; // Keep the '## ' for markdown rendering

          lessons.push({
            id: `${languageCode}-lesson-${lessonIndex}`,
            title: title,
            content: content
          });
          lessonIndex++;
        } else if (index === 0 && section.startsWith('## ')) {
          // Handle case where the *first* section IS a lesson (starts with ##)
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


    // Select and render a specific lesson by its ID
    selectLesson() {
      if (this.selectedLessonId && this.lessons.length > 0) {
        const lesson = this.lessons.find(l => l.id === this.selectedLessonId);
        if (lesson) {
          this.renderMarkdown(lesson.content);
          this.$nextTick(() => this.scrollToContentTop()); // Scroll after content update
        } else {
          console.warn("Selected lesson ID not found:", this.selectedLessonId);
          this.lessonContent = '<p>Error: Could not find the selected lesson.</p>'; // Show error in content area
        }
      } else {
        // If no lesson selected (e.g., after language change before first lesson loads)
        // this.lessonContent = null; // Keep it null or show placeholder
      }
    },

    // Render Markdown to HTML with custom processing
    renderMarkdown(markdown) {
      if (typeof marked === 'undefined') {
        console.error("marked.js library is not loaded.");
        this.errorMessage = "Error: Markdown parser not available.";
        this.errorTitle = "Display Error";
        this.lessonContent = null;
        return;
      }
      if (!markdown) {
        this.lessonContent = ''; // Clear content if markdown is empty
        return;
      }

      try {
        // 1. Pre-processing Markdown (Optional: if needed before parsing)
        //    Example: Remove specific tags or patterns if Marked can't handle them
        let processedMarkdown = markdown.replace(/^##\s+(?:Lesson\s+)?\d+:\s*/, '').trim();
        // If the above didn't remove anything (e.g., it was an intro without ## Lesson),
        // check if it starts with just a # Title (like an intro H1) and remove that too
        // ONLY IF it's likely the main title we don't want repeated. Be careful with this.
        // Let's stick to removing only the ## Lesson XX: pattern for now to avoid removing legitimate H1s.

        // Convert the *processed* markdown (without the main ## heading) to HTML
        let html = marked.parse(processedMarkdown);
        // 3. Post-processing HTML (Applying custom styles/wrappers)

        // a) Wrap tables for responsive scrolling
        //    Use a more robust regex to handle potential attributes on table tags
        html = html.replace(/<table([\s\S]*?)>/g, '<div class="table-container"><table$1>');
        html = html.replace(/<\/table>/g, '</table></div>');

        // b) Format "Thinking Points" Blockquotes
        //    Regex looks for <blockquote><p><strong>Thinking Point: optional title</strong> content </p></blockquote>
        //    It captures the optional title and the main content.
        html = html.replace(
          /<blockquote>\s*<p>\s*<strong>Thinking Point:?(.*?)<\/strong>([\s\S]*?)<\/p>\s*<\/blockquote>/gi, // Case-insensitive
          (match, title, content) => {
            const trimmedTitle = title ? title.trim() : ''; // Handle optional title
            // Ensure content is wrapped correctly, remove surrounding <p> tags if present from blockquote parsing
            let formattedContent = content.trim();
            // Basic check to remove outer <p> if content itself doesn't contain block elements like lists
            // if (!formattedContent.match(/<(ul|ol|p|div|h[1-6]|blockquote|pre|table)[^>]*>/i)) {
            //      formattedContent = formattedContent.replace(/^<p>/i, '').replace(/<\/p>$/i, '').trim();
            // }

            return `<div class="thinking-point"><div class="thinking-header">Thinking Point${trimmedTitle ? ': ' + trimmedTitle : ''}</div><div>${formattedContent}</div></div>`;
          }
        );

        // c) Format "Practice Answers" Sections
        //    Look for a specific marker paragraph and wrap subsequent content until an <hr> or end.
        const practiceStartMarker = '<p><em><strong>Practice Answers:</strong></em></p>'; // Exact marker expected from Markdown
        let practiceEndMarker = '<hr>'; // Default end marker
        let startIndex = html.indexOf(practiceStartMarker);

        while (startIndex !== -1) {
          // Replace the marker with the starting div/h4
          const replacementStart = '<div class="practice-answers"><h4>Practice Answers:</h4>';
          html = html.substring(0, startIndex) + replacementStart + html.substring(startIndex + practiceStartMarker.length);

          // Find the end marker (<hr>) after the start of the replacement
          let endIndex = html.indexOf(practiceEndMarker, startIndex + replacementStart.length);

          if (endIndex !== -1) {
            // Insert the closing div before the end marker
            html = html.substring(0, endIndex) + '</div>' + html.substring(endIndex);
          } else {
            // If no <hr> found, assume it goes to the end of the current block/html
            html += '</div>'; // Append closing div at the very end
            console.warn("Practice Answers section started but no subsequent <hr> found. Closed at end of content.");
            break; // Exit loop as we closed at the end
          }

          // Look for the next practice section *after* the one we just processed
          startIndex = html.indexOf(practiceStartMarker, startIndex + replacementStart.length + '</div>'.length + practiceEndMarker.length);
        }


        // 4. Update lesson content
        this.lessonContent = html;
        this.errorMessage = ''; // Clear any previous errors
        this.comingSoon = false; // Ensure coming soon is off

      } catch (error) {
        console.error("Error rendering Markdown:", error);
        this.errorMessage = "Sorry, we couldn't display the lesson content correctly.";
        this.errorTitle = "Display Error";
        this.errorDetails = error.message;
        this.lessonContent = null; // Clear content on rendering error
      }
    },

    // --- UI Helpers ---
    renderComingSoon() {
      this.comingSoon = true;
      this.lessonContent = null;
      this.lessons = [];
      this.selectedLessonId = '';
      this.errorMessage = ''; // Clear errors when showing coming soon
      this.currentView = 'lesson-selector'; // Ensure view is correct
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
      // Don't reset currentView here, let the calling function decide
    },

    // Format lesson title for display (e.g., in modal, floating header)
    formatLessonTitle(title) {
      if (!title) return '';
      // Removes "Lesson X: " or just "X: " if present at the start
      return title.replace(/^Lesson\s+\d+:\s*|^(\d+):\s*/i, '').trim();
    },


    // Scroll to top button visibility
    handleScroll() {
      this.showScrollTop = window.pageYOffset > 300;

      // Optional: Close header dropdown on scroll
      // if (this.showHeaderLanguageDropdown) {
      //     this.showHeaderLanguageDropdown = false;
      // }
    },

    // Scroll to top action
    scrollToTop() {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    // Scroll to the top of the main content area
    scrollToContentTop() {
      // Target the wrapper or the main content element
      const contentArea = this.$el.querySelector('.content');
      if (contentArea) {
        // Calculate offset considering the sticky header(s) height
        const headerHeight = this.$el.querySelector('header')?.offsetHeight || 0;
        const floatingHeaderHeight = this.$el.querySelector('.floating-lesson-header')?.offsetHeight || 0;
        const offset = headerHeight + floatingHeaderHeight + 20; // Add some extra padding

        const elementPosition = contentArea.getBoundingClientRect().top + window.pageYOffset;
        const offsetPosition = elementPosition - offset;

        window.scrollTo({
          top: offsetPosition,
          behavior: 'smooth'
        });
      }
    }
  }
});