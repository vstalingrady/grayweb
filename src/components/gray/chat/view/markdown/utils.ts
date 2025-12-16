import { Children, isValidElement, type ReactNode } from "react";

export const hasCodeBlockDescendant = (node: ReactNode): boolean => {
  if (!isValidElement(node)) {
    return false;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const props: any = node.props ?? {};
  if (props["data-code-block-root"]) {
    return true;
  }
  const children = props.children;
  if (!children) {
    return false;
  }
  return Children.toArray(children).some((child) => hasCodeBlockDescendant(child as ReactNode));
};

