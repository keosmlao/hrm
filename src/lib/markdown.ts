/**
 * Markdown ຂະໜາດນ້ອຍ ສຳລັບຄັງຄວາມຮູ້.
 *
 * ເປັນຂອງເຮົາເອງແທນການເພີ່ມ lib ນອກ ດ້ວຍ 2 ເຫດຜົນ:
 *   1. ໂປຣເຈັກນີ້ບໍ່ມີ rich-text/markdown dependency ຢູ່ແລ້ວ — ບໍ່ຢາກເພີ່ມ
 *   2. **escape HTML ກ່ອນສະເໝີ** ແລ້ວຄ່ອຍໃສ່ tag ຂອງເຮົາເອງ ຈຶ່ງ XSS ບໍ່ຜ່ານ
 *      (ຜູ້ຂຽນບົດເປັນຄົນໃນ ແຕ່ບໍ່ຄວນເປີດຊ່ອງໃຫ້ຝັງ script ໃສ່ໜ້າຄົນອື່ນ)
 *
 * ບໍ່ import server-only ຈຶ່ງ `npm test` ໂຫຼດໄດ້ — ແບບດຽວກັບ attendance.ts / gps-track.ts
 *
 * ຮອງຮັບ: # ຫົວຂໍ້, **ໜາ**, *ອຽງ*, `code`, ```block```, - ລາຍການ, 1. ລຳດັບ,
 *         > ອ້າງອີງ, --- ເສັ້ນ, [ຂໍ້ຄວາມ](ລິງ). ຕາຕະລາງຍັງບໍ່ຮອງຮັບ.
 */

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** ອະນຸຍາດສະເພາະລິງທີ່ປອດໄພ — ກັນ `javascript:` ແລະ `data:` */
function safeHref(href: string): string | null {
  const h = href.trim();
  if (/^https?:\/\//i.test(h)) return h;
  if (/^mailto:[^\s]+@[^\s]+$/i.test(h)) return h;
  if (/^\/[^\s]*$/.test(h)) return h; // ລິງພາຍໃນລະບົບ
  return null;
}

/** ຕົວແທນຊົ່ວຄາວຂອງ code span — NUL ພິມເອງບໍ່ໄດ້ ຈຶ່ງບໍ່ຊົນກັບເນື້ອໃນຈິງ */
const HOLD = "\u0000";

/**
 * ຮູບແບບໃນແຖວ. ຮັບຂໍ້ຄວາມ **ດິບ** ແລ້ວ escape ໃຫ້ເອງ
 * — code span ຖືກກັນໄວ້ກ່ອນ ຈຶ່ງ `**x**` ໃນ code ບໍ່ກາຍເປັນຕົວໜາ.
 */
export function renderInline(raw: string): string {
  const codes: string[] = [];
  const held = raw.replace(/`([^`]+)`/g, (_m, code: string) => {
    codes.push(`<code>${escapeHtml(code)}</code>`);
    return `${HOLD}${codes.length - 1}${HOLD}`;
  });

  let out = escapeHtml(held);

  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, text: string, href: string) => {
    const safe = safeHref(href.replace(/&amp;/g, "&"));
    if (!safe) return text;
    const external = /^https?:\/\//i.test(safe);
    const attrs = external ? ' target="_blank" rel="noopener noreferrer"' : "";
    return `<a href="${escapeHtml(safe)}"${attrs}>${text}</a>`;
  });

  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");

  return out.replace(new RegExp(`${HOLD}(\\d+)${HOLD}`, "g"), (_m, i: string) => codes[Number(i)]);
}

/** Markdown -> HTML ທີ່ປອດໄພພໍທີ່ຈະໃສ່ dangerouslySetInnerHTML */
export function renderMarkdown(src: string): string {
  const lines = (src ?? "").replace(/\r\n?/g, "\n").split("\n");
  const html: string[] = [];

  let paragraph: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  let quote: string[] = [];
  let fence: string[] | null = null;

  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    html.push(`<p>${renderInline(paragraph.join("\n")).replace(/\n/g, "<br />")}</p>`);
    paragraph = [];
  };
  const flushList = () => {
    if (!list) return;
    const tag = list.ordered ? "ol" : "ul";
    html.push(`<${tag}>${list.items.map((i) => `<li>${renderInline(i)}</li>`).join("")}</${tag}>`);
    list = null;
  };
  const flushQuote = () => {
    if (quote.length === 0) return;
    html.push(`<blockquote>${renderInline(quote.join("\n")).replace(/\n/g, "<br />")}</blockquote>`);
    quote = [];
  };
  const flushAll = () => {
    flushParagraph();
    flushList();
    flushQuote();
  };

  for (const line of lines) {
    if (fence !== null) {
      if (line.trim().startsWith("```")) {
        html.push(`<pre><code>${escapeHtml(fence.join("\n"))}</code></pre>`);
        fence = null;
      } else {
        fence.push(line);
      }
      continue;
    }

    if (line.trim().startsWith("```")) {
      flushAll();
      fence = [];
      continue;
    }

    if (line.trim() === "") {
      flushAll();
      continue;
    }

    const heading = /^(#{1,4})\s+(.*)$/.exec(line);
    if (heading) {
      flushAll();
      const level = heading[1].length + 1; // # -> h2 (h1 ເປັນຂອງຫົວຂໍ້ບົດ)
      html.push(`<h${level}>${renderInline(heading[2])}</h${level}>`);
      continue;
    }

    if (/^\s*(---+|\*\*\*+)\s*$/.test(line)) {
      flushAll();
      html.push("<hr />");
      continue;
    }

    const quoted = /^>\s?(.*)$/.exec(line);
    if (quoted) {
      flushParagraph();
      flushList();
      quote.push(quoted[1]);
      continue;
    }

    const bullet = /^\s*[-*]\s+(.*)$/.exec(line);
    const numbered = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    if (bullet || numbered) {
      flushParagraph();
      flushQuote();
      const ordered = !!numbered;
      if (!list || list.ordered !== ordered) {
        flushList();
        list = { ordered, items: [] };
      }
      list.items.push((bullet ?? numbered)![1]);
      continue;
    }

    flushList();
    flushQuote();
    paragraph.push(line);
  }

  if (fence !== null) html.push(`<pre><code>${escapeHtml(fence.join("\n"))}</code></pre>`);
  flushAll();

  return html.join("\n");
}

/** ຂໍ້ຄວາມລ້ວນຈາກ Markdown — ໃຊ້ເຮັດຄຳອະທິບາຍຫຍໍ້ໃນລາຍການ */
export function plainText(src: string): string {
  return (src ?? "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/[*_>#]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function excerpt(src: string, max = 160): string {
  const text = plainText(src);
  return text.length <= max ? text : text.slice(0, max).trimEnd() + "…";
}
