import MarketingStyles from "@/app/components/MarketingStyles";

export default function HireThanksPage() {
  return (
    <>
      <MarketingStyles />
      <main className="min-h-dvh w-full bg-black text-white flex items-center justify-center px-6 text-center">
        <div className="w-full max-w-2xl space-y-6 text-sm sm:text-base text-white/85">
          <p>Thank you for your submission. We&apos;ll reach out in 48 hours if we want to interview.</p>
          <p>&quot;The best way to predict the future is to invent it.&quot; &mdash; Alan Kay</p>
        </div>
      </main>
    </>
  );
}
