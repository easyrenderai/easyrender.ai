/* easyrender 3D & AR admin page. Plain JS: no build step. */
(() => {
  var cfg = window.easyrenderAdmin;
  var button = document.getElementById('easyrender-generate');
  if (!cfg || !button) {
    return;
  }
  var statusEl = document.getElementById('easyrender-status');
  var detailEl = document.getElementById('easyrender-detail');
  var approved = 0;
  var timer = null;

  function fmt(template, ...args) {
    return template.replace(/%(\d)\$s|%s/g, (_match, index) =>
      String(args[index ? Number(index) - 1 : 0]),
    );
  }

  function call(action, extra) {
    var body = new URLSearchParams(
      Object.assign({ action: action, _ajax_nonce: cfg.nonce }, extra || {}),
    );
    return fetch(cfg.ajaxUrl, { method: 'POST', body: body, credentials: 'same-origin' })
      .then((response) => response.json())
      .then((json) => {
        if (!json.success) {
          throw new Error(json.data?.message || 'Request failed');
        }
        return json.data;
      });
  }

  function show(summary) {
    var lines = [];
    var ready = summary.ready || 0;
    var running = (summary.drafting || 0) + (summary.building || 0);
    if (summary.total) {
      lines.push(fmt(cfg.i18n.progress, ready, running, summary.queued || 0));
    }
    if (summary.needs_credits) {
      lines.push(fmt(cfg.i18n.needsCredit, summary.needs_credits));
    }
    if (summary.needs_info) {
      lines.push(fmt(cfg.i18n.needsInfo, summary.needs_info));
    }
    if (summary.failed) {
      lines.push(fmt(cfg.i18n.failed, summary.failed));
    }
    statusEl.textContent = lines.join(' · ');
    return (summary.queued || 0) + running > 0;
  }

  function poll() {
    clearTimeout(timer);
    call('easyrender_sync')
      .then((data) => {
        if (show(data.summary)) {
          timer = setTimeout(poll, 10000);
        } else {
          prepare();
        }
      })
      .catch((error) => {
        detailEl.textContent = cfg.i18n.error + ' ' + error.message;
        timer = setTimeout(poll, 30000);
      });
  }

  function prepare() {
    call('easyrender_prepare')
      .then((data) => {
        var inProgress = show(data.summary);
        detailEl.textContent = data.noPhoto ? fmt(cfg.i18n.noPhoto, data.noPhoto) : '';
        if (data.count > 0 && data.quote) {
          approved = data.quote.totalCredits;
          button.disabled = false;
          button.textContent = fmt(cfg.i18n.generate, data.count, data.quote.totalCredits);
          button.dataset.count = String(data.count);
        } else {
          button.disabled = true;
          button.textContent = cfg.i18n.nothing;
        }
        if (inProgress) {
          timer = setTimeout(poll, 10000);
        }
      })
      .catch((error) => {
        button.textContent = cfg.i18n.error;
        detailEl.textContent = error.message;
      });
  }

  function submit(first, sentSoFar) {
    return call('easyrender_submit', { first: first ? 1 : 0, approved: approved }).then((data) => {
      var sent = sentSoFar + data.sent;
      statusEl.textContent = fmt(cfg.i18n.starting, sent);
      return data.remaining > 0 && data.sent > 0 ? submit(false, sent) : sent;
    });
  }

  button.addEventListener('click', () => {
    button.disabled = true;
    submit(true, 0)
      .then(poll)
      .catch((error) => {
        detailEl.textContent = cfg.i18n.error + ' ' + error.message;
        prepare();
      });
  });

  prepare();
})();
