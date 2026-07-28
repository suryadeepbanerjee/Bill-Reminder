import React from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "destructive" | "accent";
type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: "left" | "right";
  fullWidth?: boolean;
}

const variants: Record<ButtonVariant, string> = {
  primary: "bg-primary text-canvas hover:bg-primary/90 shadow-resting",
  accent: "bg-accent text-accent-text hover:bg-accent-hover shadow-fab",
  secondary: "bg-surface border border-border text-primary hover:bg-input shadow-resting",
  ghost: "bg-transparent text-secondary hover:bg-input hover:text-primary",
  destructive: "bg-error/10 border border-error/20 text-error hover:bg-error/20",
};

const sizes: Record<ButtonSize, string> = {
  sm: "py-2 px-4 text-sm gap-1.5",
  md: "py-3 px-5 text-sm gap-2",
  lg: "py-4 px-6 text-base gap-2",
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className = "",
      variant = "primary",
      size = "md",
      loading = false,
      disabled,
      icon,
      iconPosition = "left",
      fullWidth = false,
      children,
      ...props
    },
    ref
  ) => {
    const v = variants[variant];
    const s = sizes[size];
    const isDisabled = disabled || loading;

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        className={`inline-flex items-center justify-center rounded-input font-medium transition-all duration-150 active:scale-[0.98] ${v} ${s} ${fullWidth ? "w-full" : ""} ${isDisabled ? "opacity-50 cursor-not-allowed active:scale-100" : ""} ${className}`}
        {...props}
      >
        {loading ? (
          <span className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
        ) : (
          <>
            {icon && iconPosition === "left" && icon}
            {children}
            {icon && iconPosition === "right" && icon}
          </>
        )}
      </button>
    );
  }
);
Button.displayName = "Button";
