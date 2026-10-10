import React, { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { type Problem, problemset } from './cf';
import { editorialSection } from './editorial';

type Props = { problem: Problem; onLoaded: (editorial: string | null) => void };

// Cloudflare's check plus two page loads; past this, Gemma goes without.
const TIMEOUT_MS = 30_000;

// Runs after every page load. Cloudflare blocks plain fetches, so a real browser walks
// contest page -> its "Tutorial" link -> the editorial, then returns the text with all code removed.
const EXTRACT = `(function () {
  var post = function (text) { window.ReactNativeWebView.postMessage(JSON.stringify({ text: text })); };
  var all = function (root, selector) { return Array.prototype.slice.call(root.querySelectorAll(selector)); };
  if (/^\\/contest\\/\\d+\\/?$/.test(location.pathname)) {
    var tutorials = all(document, '.sidebox a[href*="/blog/entry/"]').filter(function (a) {
      return /tutorial|editorial/i.test(a.textContent);
    });
    var link = tutorials.filter(function (a) { return !/\\(ru\\)/i.test(a.textContent); })[0] || tutorials[0];
    if (link) location.href = link.href; else post(null);
  } else if (/^\\/blog\\/entry\\//.test(location.pathname)) {
    var body = document.querySelector('.topic .content .ttypography');
    if (!body) return post(null);
    all(body, 'script[type^="math/tex"]').forEach(function (s) { s.replaceWith('$' + s.textContent + '$'); });
    all(body, 'pre, code, .MathJax, .MathJax_Preview, .MathJax_Display, .MJX_Assistive_MathML').forEach(function (e) { e.remove(); });
    all(body, '.spoiler-content').forEach(function (e) { e.style.display = 'block'; });
    post(body.innerText);
  }
})();
true;`;

/** Invisible browser that finds the editorial for one problem, or reports null. */
export function EditorialLoader({ problem, onLoaded }: Props) {
  const done = useRef(false);
  const finish = (editorial: string | null) => {
    if (done.current) return;
    done.current = true;
    onLoaded(editorial);
  };

  useEffect(() => {
    const timeout = setTimeout(() => finish(null), TIMEOUT_MS);
    return () => clearTimeout(timeout);
  }, []);

  async function onMessage(event: WebViewMessageEvent) {
    try {
      const { text } = JSON.parse(event.nativeEvent.data) as { text: string | null };
      if (!text) return finish(null);
      const siblings = (await problemset())
        .filter((p) => p.contestId === problem.contestId && p.index !== problem.index)
        .map((p) => p.name);
      finish(editorialSection(text, problem.name, siblings));
    } catch {
      finish(null);
    }
  }

  return (
    <View style={styles.hidden} pointerEvents="none">
      <WebView
        source={{ uri: `https://codeforces.com/contest/${problem.contestId}` }}
        injectedJavaScript={EXTRACT}
        onMessage={onMessage}
        onError={() => finish(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  hidden: { position: 'absolute', width: 360, height: 640, opacity: 0 },
});
