document.addEventListener('DOMContentLoaded', function() {
  // Theme toggle functionality
  const themeToggleBtn = document.getElementById('themeToggle');
  const themeIcon = themeToggleBtn.querySelector('i');

  themeToggleBtn.addEventListener('click', function() {
    document.body.classList.toggle('dark-theme');

    if (document.body.classList.contains('dark-theme')) {
      themeIcon.classList.remove('fa-moon');
      themeIcon.classList.add('fa-sun');
      localStorage.setItem('theme', 'dark');
    } else {
      themeIcon.classList.remove('fa-sun');
      themeIcon.classList.add('fa-moon');
      localStorage.setItem('theme', 'light');
    }
  });

  // Load saved theme from localStorage
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme === 'dark') {
    document.body.classList.add('dark-theme');
    themeIcon.classList.remove('fa-moon');
    themeIcon.classList.add('fa-sun');
  }

  // Language selection
  const customSelect = document.querySelector('.custom-select');
  const selectedText = document.getElementById('selectedLanguage');
  const selectItems = document.querySelector('.select-items');
  const lessonContent = document.getElementById('lesson');
  const placeholderContent = document.getElementById('placeholderContent');
  const loadingIndicator = document.getElementById('loading');
  const lessonSelector = document.getElementById('lessonSelector');
  const lessonSelectorContainer = document.getElementById('lessonSelectorContainer');

  // Toggle dropdown
  selectedText.addEventListener('click', function() {
    selectItems.classList.toggle('select-hide');
  });

  // Close dropdown when clicking outside
  document.addEventListener('click', function(e) {
    if (!customSelect.contains(e.target)) {
      selectItems.classList.add('select-hide');
    }
  });

  // Handle language selection
  document.querySelectorAll('.select-item').forEach(item => {
    item.addEventListener('click', function() {
      const selectedLanguage = this.getAttribute('data-value');
      selectedText.innerHTML = selectedLanguage ? this.innerHTML : '<span>--Select a language--</span>';
      selectItems.classList.add('select-hide');

      if (selectedLanguage) {
        // Show loading indicator
        placeholderContent.style.display = 'none';
        loadingIndicator.style.display = 'flex';
        lessonSelectorContainer.style.display = 'none';

        // Simulate loading delay
        setTimeout(function() {
          fetchLanguageContent(selectedLanguage);
        }, 1000);
      } else {
        lessonContent.innerHTML = '';
        placeholderContent.style.display = 'block';
        loadingIndicator.style.display = 'none';
        lessonSelectorContainer.style.display = 'none';
      }
    });
  });

  // Lesson selection
  lessonSelector.addEventListener('change', function() {
    const selectedLesson = this.value;
    const lessons = JSON.parse(localStorage.getItem('currentLessons') || '[]');

    if (selectedLesson && lessons.length > 0) {
      // Find the selected lesson
      const lesson = lessons.find(l => l.id === selectedLesson);
      if (lesson) {
        renderMarkdown(lesson.content);

        // Scroll to top when changing lessons
        window.scrollTo({
          top: 0,
          behavior: 'smooth'
        });
      }
    }
  });

  // Scroll to top button
  const scrollToTopBtn = document.getElementById('scrollToTop');

  window.addEventListener('scroll', function() {
    if (window.pageYOffset > 300) {
      scrollToTopBtn.classList.add('visible');
    } else {
      scrollToTopBtn.classList.remove('visible');
    }
  });

  scrollToTopBtn.addEventListener('click', function() {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  });

  // Set current year in footer
  const yearElement = document.getElementById('currentYear');
  if (yearElement) {
    yearElement.textContent = new Date().getFullYear();
  }

  // Function to fetch language content
  async function fetchLanguageContent(language) {
    try {
      const fileName = `./courses/${language}-lesson.md`;
      // Fetch the markdown content from the file
      const response = await fetch(fileName);

      if (!response.ok) {
        throw new Error(`Failed to load lesson content: ${response.status} ${response.statusText}`);
      }

      const markdown = await response.text();

      // Split the markdown into lessons
      const lessons = splitIntoLessons(markdown, language);

      // Store lessons in localStorage for later use
      localStorage.setItem('currentLessons', JSON.stringify(lessons));

      // Populate lesson selector
      populateLessonSelector(lessons);

      // Display lesson selector
      lessonSelectorContainer.style.display = 'block';

      // Select the first lesson by default
      if (lessons.length > 0) {
        lessonSelector.value = lessons[0].id;
        renderMarkdown(lessons[0].content);
      } else {
        renderComingSoon(language);
      }
    } catch (error) {
      console.error('Error loading lesson:', error);
      lessonContent.innerHTML = `
        <div class="error-message">
          <i class="fas fa-exclamation-circle" style="font-size: 40px; color: var(--danger-color); margin-bottom: 15px;"></i>
          <h3>Failed to Load Lesson</h3>
          <p>Sorry, we couldn't load the lesson content. Please try again later.</p>
          <p class="error-details">${error.message}</p>
        </div>
      `;
      lessonSelectorContainer.style.display = 'none';
    } finally {
      loadingIndicator.style.display = 'none';
    }
  }

  // Function to split markdown into lessons based on ## headings
  function splitIntoLessons(markdown, language) {
    // Get the first line (main title)
    const lines = markdown.split('\n');
    let mainTitle = '';

    // Find the main title (# heading)
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith('# ')) {
        mainTitle = lines[i].substring(2).trim();
        break;
      }
    }

    // Split by ## headings
    const sections = markdown.split(/^## /gm);

    // The first section might be the introduction or empty, check if it starts with a # heading
    const lessons = [];

    for (let i = 0; i < sections.length; i++) {
      let section = sections[i].trim();

      // Skip empty sections
      if (!section) continue;

      // For the first section, check if it's an intro or already a lesson
      if (i === 0 && !section.startsWith('#')) {
        // This is an introduction section
        lessons.push({
          id: `${language}-intro`,
          title: 'Introduction',
          content: section
        });
      } else {
        // This is a lesson section, get the title from the first line
        const sectionLines = section.split('\n');
        const title = sectionLines[0].trim();

        // Reconstruct the section with ## prefix for proper rendering
        const content = `## ${section}`;

        lessons.push({
          id: `${language}-lesson-${i}`,
          title: title,
          content: content
        });
      }
    }

    return lessons;
  }

  // Function to populate lesson selector
  function populateLessonSelector(lessons) {
    // Clear previous options
    lessonSelector.innerHTML = '';

    // Add default option
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = '--Select a lesson--';
    lessonSelector.appendChild(defaultOption);

    // Add lesson options
    lessons.forEach(lesson => {
      const option = document.createElement('option');
      option.value = lesson.id;
      option.textContent = lesson.title;
      lessonSelector.appendChild(option);
    });
  }

  // Configure marked.js to handle our custom styling needs
  marked.setOptions({
    renderer: new marked.Renderer(),
    highlight: null,
    pedantic: false,
    gfm: true,
    breaks: true,
    sanitize: false, // Allow HTML in the markdown
    smartLists: true,
    smartypants: false,
    xhtml: false
  });

  function renderMarkdown(markdown) {
    if (typeof marked === 'undefined') {
      console.error("marked.js library is not loaded.");
      lessonContent.innerHTML = "<p>Error: Markdown parser not available.</p>";
      return;
    }

    try {
      // 1. Let marked.js handle all standard Markdown conversion first.
      //    It will correctly convert ein**en** to ein<strong>en</strong>, etc.
      let html = marked.parse(markdown);

      // --- DEBUGGING ---
      // Uncomment the next line to see the raw HTML output from marked
      // *before* any custom replacements are applied. Check your browser's
      // developer console. You should see <strong> tags here if ** was used.
      // console.log("Raw HTML from marked:", html);
      // --- END DEBUGGING ---


      // 2. Apply custom transformations to the generated HTML:

      // a) Wrap tables for responsive scrolling
      //    Ensures <table> is immediately inside .table-container
      html = html.replace(/<table>/g, '<div class="table-container"><table>');
      html = html.replace(/<\/table>/g, '</table></div>');


      // b) Format "Thinking Points"
      //    Looks for the specific blockquote structure generated by marked
      //    from "> **Thinking Point: Title** \n > Content..."
      html = html.replace(
        /<blockquote>\s*<p>\s*<strong>Thinking Point:(.*?)<\/strong>([\s\S]*?)<\/p>\s*<\/blockquote>/gs,
        (match, title, content) => {
          // Trim potential whitespace and ensure content is wrapped in <p> if not already
          const trimmedContent = content.trim();
          const formattedContent = trimmedContent.startsWith('<p>') ? trimmedContent : `<p>${trimmedContent}</p>`;
          return `<div class="thinking-point"><div class="thinking-header">Thinking Point:${title.trim()}</div>${formattedContent}</div>`;
        }
      );
      // Added 's' flag to regex for multi-line content within the blockquote paragraph.


      // c) Format "Practice Answers"
      //    Replaces the specific introductory paragraph and wraps content until the next <hr>

      // Find the start first to avoid unnecessary complex regex later
      const practiceStartPattern = /<p><em><strong>Practice Answers:<\/strong><\/em><\/p>/g;
      if (practiceStartPattern.test(html)) {
        // Replace the header paragraph with the opening div and h4
        html = html.replace(practiceStartPattern, '<div class="practice-answers"><h4>Practice Answers:</h4>');

        // Now, find the *first* <hr> *after* the opening div and insert </div> before it.
        // This is more robust than a single regex trying to do everything.
        const openDivMarker = '<div class="practice-answers">';
        const openDivIndex = html.indexOf(openDivMarker);

        if (openDivIndex !== -1) {
          const hrIndex = html.indexOf('<hr>', openDivIndex + openDivMarker.length);

          if (hrIndex !== -1) {
            // Insert the closing div right before the <hr>
            html = html.substring(0, hrIndex) + '</div>' + html.substring(hrIndex);
          } else {
            // If no <hr> is found after the practice answers start,
            // the closing </div> won't be added. This might be okay if it's the
            // last element, but log a warning.
            console.warn("Practice Answers section started but no subsequent <hr> found to mark its end. The closing </div> might be missing.");
            // Optionally, you could try adding the </div> at the very end, but it's risky:
            // html += '</div>'; // <-- Use with caution
          }
        }
      }

      // 3. Inject the final HTML into the DOM
      lessonContent.innerHTML = html;

    } catch (error) {
      console.error("Error rendering Markdown:", error);
      lessonContent.innerHTML = `<div class="error-message">
          <i class="fas fa-exclamation-circle" style="font-size: 40px; color: var(--danger-color); margin-bottom: 15px;"></i>
          <h3>Markdown Rendering Failed</h3>
          <p>Sorry, we couldn't display the lesson content correctly.</p>
          <p class="error-details">${error.message}</p>
        </div>`;
    }
  }


  // Function to show coming soon message
  function renderComingSoon(language) {
    const capitalizedLanguage = language.charAt(0).toUpperCase() + language.slice(1);

    lessonContent.innerHTML = `
      <div class="coming-soon">
        <div class="placeholder-icon">
          <i class="fas fa-clock"></i>
        </div>
        <h3>${capitalizedLanguage} Lessons Coming Soon!</h3>
        <p>We're working hard to create a comprehensive ${language} learning experience. 
        Check back soon or subscribe to our newsletter to be notified when it's ready.</p>
        <button class="primary-btn" style="margin-top: 20px;">Get Notified</button>
      </div>
    `;
  }
});