export const Logo = ({ size = 36 }: { size?: number }) => (
  <img src="icon-512.png?v=1" width={size} height={size} className="rounded-[22%]" alt="" />
)

export const Wordmark = () => (
  <span className="font-black italic tracking-tight leading-none">
    REPLAY <span className="bg-[linear-gradient(110deg,#2ef2b4,#1a7cff)] bg-clip-text text-transparent pr-0.5">BOARD</span>
  </span>
)
