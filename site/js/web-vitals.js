// Web Vitals мониторинг
(function(){
  let webVitals = {
    cls: 0,
    fid: 0,
    lcp: 0,
    fcp: 0,
    ttfb: 0
  };

  // Largest Contentful Paint
  let lcpObserver = new PerformanceObserver((entryList) => {
    let entries = entryList.getEntries();
    let lastEntry = entries[entries.length - 1];
    webVitals.lcp = lastEntry.startTime;
    console.log('LCP:', webVitals.lcp);
  });
  lcpObserver.observe({entryTypes: ['largest-contentful-paint']});

  // First Input Delay
  let fidObserver = new PerformanceObserver((entryList) => {
    let entries = entryList.getEntries();
    entries.forEach((entry) => {
      webVitals.fid = entry.processingStart - entry.startTime;
      console.log('FID:', webVitals.fid);
    });
  });
  fidObserver.observe({entryTypes: ['first-input']});

  // Cumulative Layout Shift
  let clsObserver = new PerformanceObserver((entryList) => {
    let score = 0;
    entryList.getEntries().forEach((entry) => {
      if (!entry.hadRecentInput) {
        score += entry.value;
      }
    });
    webVitals.cls = score;
    console.log('CLS:', webVitals.cls);
  });
  clsObserver.observe({entryTypes: ['layout-shift']});

  // First Contentful Paint
  let fcpObserver = new PerformanceObserver((entryList) => {
    let entries = entryList.getEntries();
    entries.forEach((entry) => {
      webVitals.fcp = entry.startTime;
      console.log('FCP:', webVitals.fcp);
    });
  });
  fcpObserver.observe({entryTypes: ['paint']});

  // Time to First Byte
  if (performance && performance.timing) {
    webVitals.ttfb = performance.timing.responseStart - performance.timing.navigationStart;
    console.log('TTFB:', webVitals.ttfb);
  }

  // Отправка метрик
  window.addEventListener('unload', () => {
    // Можно настроить отправку на сервер аналитики
    console.log('Final Web Vitals:', webVitals);
  });
})();