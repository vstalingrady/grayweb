import type { Content, Paragraph, Parent as MdastParent, Root, Text } from "mdast";
import type { Plugin } from "unified";
import { visitParents } from "unist-util-visit-parents";

const INLINE_LATEX_START = "\\(";
const INLINE_LATEX_END = "\\)";
const DISPLAY_LATEX_PATTERN = /^\s*\\\[([\s\S]+?)\\\]\s*$/;

const isEscaped = (value: string, index: number): boolean => index > 0 && value[index - 1] === "\\";

const pushTextNode = (nodes: Content[], value: string) => {
  if (!value) {
    return;
  }
  nodes.push({
    type: "text",
    value,
  } as Text);
};

const remarkGrayLatex: Plugin<[], Root> = () => {
  return (tree) => {
    visitParents(tree, "paragraph", (paragraph, ancestors) => {
      if (!paragraph || paragraph.type !== "paragraph" || paragraph.children.length !== 1) {
        return;
      }
      const soleChild = paragraph.children[0];
      if (!soleChild || soleChild.type !== "text") {
        return;
      }
      const match = DISPLAY_LATEX_PATTERN.exec(soleChild.value);
      if (!match) {
        return;
      }
      const mathValue = match[1]?.trim();
      if (!mathValue) {
        return;
      }
      const parent = ancestors[ancestors.length - 1] as MdastParent | undefined;
      if (!parent || !Array.isArray(parent.children)) {
        return;
      }
      const index = parent.children.indexOf(paragraph as Paragraph);
      if (index === -1) {
        return;
      }
      parent.children.splice(index, 1, {
        type: "math",
        value: mathValue,
      } as Content);
    });

    visitParents(tree, "text", (textNode, ancestors) => {
      if (!textNode || textNode.type !== "text") {
        return;
      }
      const value = textNode.value;
      if (!value || value.indexOf(INLINE_LATEX_START) === -1) {
        return;
      }
      const replacements: Content[] = [];
      let cursor = 0;

      while (cursor < value.length) {
        const start = value.indexOf(INLINE_LATEX_START, cursor);
        if (start === -1) {
          break;
        }
        if (isEscaped(value, start)) {
          cursor = start + INLINE_LATEX_START.length;
          continue;
        }
        const end = value.indexOf(INLINE_LATEX_END, start + INLINE_LATEX_START.length);
        if (end === -1) {
          break;
        }
        if (value.slice(start + INLINE_LATEX_START.length, end).includes("\n")) {
          cursor = end + INLINE_LATEX_END.length;
          continue;
        }
        pushTextNode(replacements, value.slice(cursor, start));

        const mathValue = value.slice(start + INLINE_LATEX_START.length, end).trim();
        if (mathValue) {
          replacements.push({
            type: "inlineMath",
            value: mathValue,
          } as Content);
        }
        cursor = end + INLINE_LATEX_END.length;
      }

      if (!replacements.length) {
        return;
      }
      pushTextNode(replacements, value.slice(cursor));

      const parent = ancestors[ancestors.length - 1] as MdastParent | undefined;
      if (!parent || !Array.isArray(parent.children)) {
        return;
      }
      const index = parent.children.indexOf(textNode as Text);
      if (index === -1) {
        return;
      }
      parent.children.splice(index, 1, ...replacements);
    });
  };
};

export default remarkGrayLatex;
