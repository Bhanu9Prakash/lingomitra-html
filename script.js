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
  const languageSelect = document.getElementById('languageSelect');
  const lessonContent = document.getElementById('lesson');
  const placeholderContent = document.getElementById('placeholderContent');
  const loadingIndicator = document.getElementById('loading');

  languageSelect.addEventListener('change', function() {
    const selectedLanguage = this.value;

    if (selectedLanguage) {
      // Show loading indicator
      placeholderContent.style.display = 'none';
      loadingIndicator.style.display = 'flex';

      // Simulate loading delay
      setTimeout(function() {
        fetchLessonContent(selectedLanguage);
      }, 1000);
    } else {
      lessonContent.innerHTML = '';
      placeholderContent.style.display = 'block';
      loadingIndicator.style.display = 'none';
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

  // Function to fetch lesson content
  async function fetchLessonContent(language) {
    try {
      if (language === 'german') {
        // Fetch the markdown content from the file
        const response = await fetch('german-lesson.md');

        if (!response.ok) {
          throw new Error(`Failed to load lesson content: ${response.status} ${response.statusText}`);
        }

        const markdown = await response.text();
        renderMarkdown(markdown);
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
    } finally {
      loadingIndicator.style.display = 'none';
    }
  }

  // Function to render markdown content
  function renderMarkdown(markdown) {
    // Use marked.js to convert markdown to HTML
    let html = marked.parse(markdown);

    // Custom formatting for tables
    html = html.replace(/<table>/g, '<div class="table-container"><table>');
    html = html.replace(/<\/table>/g, '</table></div>');

    // Custom formatting for thinking points
    html = html.replace(/<blockquote>\s*<p>\s*<strong>Thinking Point:(.*?)<\/strong>([\s\S]*?)<\/p>\s*<\/blockquote>/g,
      '<div class="thinking-point"><div class="thinking-header">Thinking Point:$1</div><p>$2</p></div>');

    // Custom formatting for practice answers
    html = html.replace(/<p><em><strong>Practice Answers:<\/strong><\/em><\/p>/g,
      '<div class="practice-answers"><h4>Practice Answers:</h4>');
    html = html.replace(/<hr>/g, '</div><hr>');

    lessonContent.innerHTML = html;
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