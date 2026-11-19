const promises = [
  {
    n: "01",
    title: "Personally verified",
    text: "Every property is reviewed for comfort, safety and quality before it goes live.",
  },
  {
    n: "02",
    title: "Secure payment",
    text: "Protected checkout in naira with no hidden fees, ever.",
  },
  {
    n: "03",
    title: "Flexible cancellation",
    text: "Choose stays with free cancellation options that fit real plans.",
  },
  {
    n: "04",
    title: "24/7 support",
    text: "Our Nigerian travel team is always one message away.",
  },
];

export function PromiseSection() {
  return (
    <section className="container-page pt-16 sm:pt-24">
      <div className="grid gap-10 lg:grid-cols-[0.85fr_2fr] lg:gap-16">
        <div>
          <span className="eyebrow">The JosStay promise</span>
          <h2 className="mt-4 font-display text-[32px] font-bold leading-[1.02] tracking-tightest text-ink sm:text-[38px]">
            Local knowledge.
            <br />
            Thoughtful stays.
          </h2>
        </div>
        <div className="grid gap-x-8 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
          {promises.map((item) => (
            <div key={item.n}>
              <span className="font-display text-[13px] font-semibold italic text-plum-300">
                {item.n}
              </span>
              <h3 className="mt-3 font-display text-[16px] font-bold text-ink">
                {item.title}
              </h3>
              <p className="mt-2 text-[13px] leading-relaxed text-muted">
                {item.text}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
