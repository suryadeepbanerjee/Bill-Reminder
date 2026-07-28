import React, { HTMLAttributes } from "react";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: boolean;
  clickable?: boolean;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className = "", padding = true, clickable = false, children, ...props }, ref) => {
    const base = `bg-surface border border-border rounded-card shadow-resting ${
      padding ? "p-6" : ""
    } ${
      clickable
        ? "cursor-pointer transition-all duration-150 hover:border-accent hover:shadow-raised active:scale-[0.99]"
        : ""
    } ${className}`;

    return (
      <div ref={ref} className={base} {...props}>
        {children}
      </div>
    );
  }
);
Card.displayName = "Card";
