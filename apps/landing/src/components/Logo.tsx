export function Logo() {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="relative flex h-[22px] w-[22px] items-center justify-center rounded-[7px] bg-ink">
        <span className="text-[13px] font-semibold leading-none tracking-[-0.02em] text-white">
          A
        </span>
        <span className="absolute bottom-0 right-0 h-[5px] w-[5px] translate-x-1/4 translate-y-1/4 rounded-full bg-accent" />
      </span>
      <span className="text-[17px] font-semibold tracking-[-0.02em] text-text-primary">
        Aliquo
      </span>
    </span>
  );
}
