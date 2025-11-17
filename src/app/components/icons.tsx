import type { HTMLAttributes } from "react";

type IconProps = HTMLAttributes<HTMLElement> & {
  size?: number;
};

const Icon = ({ name, size = 18, className, ...rest }: IconProps & { name: string }) => (
  <i
    className={className ? `lni ${name} ${className}` : `lni ${name}`}
    style={{ fontSize: `${size}px`, width: size, height: size, lineHeight: `${size}px` }}
    aria-hidden="true"
    {...rest}
  />
);

export const Icons = {
  google: (props: IconProps) => <Icon name="lni-google" {...props} />,
  discord: (props: IconProps) => <Icon name="lni-discord" {...props} />
};
