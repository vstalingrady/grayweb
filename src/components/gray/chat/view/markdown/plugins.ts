import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import type { PluggableList } from "unified";
import remarkGrayLatex from "@/lib/remarkGrayLatex";

export const MARKDOWN_PLUGINS: PluggableList = [
  // Rely on explicit math markers and convert them into KaTeX-friendly
  // dollar fences so currency like `$20` stays untouched.
  [remarkMath, { singleDollarTextMath: false }],
  remarkGfm,
  remarkGrayLatex,
];
