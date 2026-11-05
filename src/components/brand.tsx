import { clsx } from "@/components/clsx";

export function BrandMark({
  size = 40,
  className,
  alt = "",
}: {
  size?: number;
  className?: string;
  alt?: string;
}) {
  return (
    <img
      src="/mark.png"
      alt={alt}
      width={size}
      height={size}
      className={clsx("shrink-0 rounded-[18%] bg-navy-900", className)}
      decoding="async"
    />
  );
}

export function BrandLockup({
  size = 40,
  subtitle,
  invert = true,
  compactOnMobile = false,
}: {
  size?: number;
  subtitle?: string;
  invert?: boolean;
  compactOnMobile?: boolean;
}) {
  return (
    <span className="flex min-w-0 items-center gap-3">
      <BrandMark size={size} alt="" />
      <span className="min-w-0">
        <span className={clsx("display block truncate font-bold leading-none", invert ? "text-white" : "text-navy-900", compactOnMobile ? "text-base sm:text-xl" : size >= 48 ? "text-3xl" : "text-xl")}>
          ResponderRoadmap
        </span>
        {subtitle ? (
          <span
            className={clsx(
              "mt-1 block text-[11px] font-semibold uppercase tracking-[0.14em]",
              compactOnMobile && "hidden sm:block",
              invert ? "text-white/50" : "text-navy-400",
            )}
          >
            {subtitle}
          </span>
        ) : null}
      </span>
    </span>
  );
}
