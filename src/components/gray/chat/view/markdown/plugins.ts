import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkGrayLatex from "@/lib/remarkGrayLatex";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const MARKDOWN_PLUGINS: any = [
  // Rely on explicit math markers and convert them into KaTeX-friendly
  // dollar fences so currency like `$20` stays untouched.
  [remarkMath, { singleDollarTextMath: false }],
  remarkGfm,
  remarkGrayLatex,
];

