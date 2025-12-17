import { Children, isValidElement, type ReactNode } from "react";

export const hasCodeBlockDescendant = (node: ReactNode): boolean => {
  if (!isValidElement(node)) {
    return false;
  }
  const props = node.props as { children?: ReactNode; ["data-code-block-root"]?: unknown };
  if (props["data-code-block-root"]) {
    return true;
  }
  const children = props.children;
  if (!children) {
    return false;
  }
  return Children.toArray(children).some((child) => hasCodeBlockDescendant(child as ReactNode));
};
