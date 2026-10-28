import { copyText } from '../../../assets/js/shared/content.js';
import { escapeHtml } from './http.js';

// An element marked data-copy="<key>" holding plain text (the pages keep it that way)
const MARKED = /<([a-z][a-z0-9]*)(\s[^>]*?\bdata-copy="([^"]+)"[^>]*)>([^<]*)<\/\1>/g;

/** Writes Hunter's page text into the HTML, so it's there on first paint and for crawlers. */
export const applyCopy = (html, copy, settings) =>
	html.replace(MARKED, (match, tag, attrs, key) => `<${tag}${attrs}>${escapeHtml(copyText(copy, key, settings))}</${tag}>`);
