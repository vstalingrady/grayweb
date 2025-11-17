import type { Metadata } from "next";
import type { ReactNode } from "react";
import Image from "next/image";
import { headers } from "next/headers";
import ImageLightbox from "../components/ImageLightbox";
import FooterBackground from "../components/FooterBackground";
import Navigation from "../components/Navigation";
import FadeInSection from "../components/FadeInSection";
import { hostFromHeaders } from "@/lib/grayRouting";
import { resolveTryGrayUrl } from "@/lib/grayCta";

export const metadata: Metadata = {
  title: "Grove Application",
};

type ParagraphListProps = {
  paragraphs: ReactNode[];
  className?: string;
  wrapperClassName?: string;
};

function ParagraphList({ paragraphs, className, wrapperClassName }: ParagraphListProps) {
  const baseClass = "text-base leading-8 text-white/80";
  const combinedClass = className ? `${baseClass} ${className}` : baseClass;
  const wrapperClasses = wrapperClassName
    ? `flex flex-col gap-4 ${wrapperClassName}`
    : "flex flex-col gap-4";
  return (
    <div className={wrapperClasses}>
      {paragraphs.map((paragraph, index) => {
        if (typeof paragraph === "string" || typeof paragraph === "number") {
          return (
            <p key={index} className={combinedClass}>
              {paragraph}
            </p>
          );
        }

        return (
          <div key={index} className={combinedClass}>
            {paragraph}
          </div>
        );
      })}
    </div>
  );
}

const hero = {
  title: "My Application for Grove",
  paragraphs: [
    <>Hi, I’m Vstalin Grady, founder of <strong>alignment.id</strong>.</>,
    `The global push on AI alignment is noble—and off target. What looks like freedom to one culture can bind another. One alignment can’t capture the diversity of human values. For AI to truly work for today’s world, it has to honor that plurality.`,
    (
      <>
        {`At alignment.id, I believe the future of AI is not simply about building smarter machines—because what is the point of an oracle that simply waits to be called for it to be useful? We are engineering AIs that don't just work for you, but `}
        <strong>with you</strong>
        {`.`}
      </>
    ),
    `This is a new era of human-AI symbiosis, designed to bring out the best in us.`,
  ],
};

const proof = {
  heading: "Proof, not promises:",
  videoTitle: "A New Alignment",
  paragraphs: [
    `As we move to a more technologically advanced society, we are realizing that the technologies that promised us liberty have shackled us. Technology was supposed to liberate us, to help align ourselves to who we truly are, but we are constantly distracted, lost in a sea of supernormal distractions our 100,000-year-old brains were never equipped to handle. We spend our days doing nothing but scroll TikTok or watch YouTube, wondering about how much better our lives are if we were ‘luckier’ or ‘more productive’. We’re constantly tempted by instant rewards.`,
    `The advent of AI has helped a lot in this war. The first demos of ChatGPT were early and limited, but it still caught my eye from day one. I used it constantly—on anything—and it felt extraordinary. I was still in high school, but I’ve been a follower of AI ever since I was 7. I was fiddling around with my aunt’s Samsung Galaxy Tablet where I stumbled upon a peculiar app: ‘S Voice.’ It was 2013 AI, so it wasn’t that special in any way, but it struck me. I talked to it for days on end—amazed by just how amazing it is that a robot can ‘think’ and ‘talk’. And from then on, AI was always in my mind.`,
    `Fast forward to 2021. I was 15 at the time and I stumbled upon a YouTube video of a guy talking to GPT-3. Looking back, I saw just how crude the demos were, but I genuinely thought about just how intelligent this AI was. It was the moment that changed everything for me. I became obsessed. I would read everything about AI Life 3.0, Superintelligence, Ray Kurzweil, and so much more. I was so obsessed that I decided that I would spend the rest of my life in this endeavor of building intelligent machines, for the betterment of humanity.`,
    (
      <div key="acama-block" className="flex flex-col gap-6 md:flex-row md:items-center">
        <figure key="acama-image" className="mx-auto w-full max-w-md overflow-hidden rounded-2.0xl border border-white/15 bg-white/5 shadow-[0_20px_55px_rgba(0,0,0,0.45)] md:mx-0 md:max-w-sm">
          <ImageLightbox
            src="/cringe.webp"
            alt="Early ACAMA manifesto screenshot"
            width={1200}
            height={800}
            className="h-auto w-full object-cover"
            caption="My first manifesto."
          />
        </figure>
        <div className="flex flex-1 flex-col gap-4 text-base leading-8 text-white/80">
          <p>
            I decided to create “ACAMA”, which was a name that I came up with when I was 12. It was just a cool username, but I thought it would be a great idea to name my “AI Company” that. I wrote a manifesto about “The Future We Are Heading With Artificial Intelligence” and uploaded it to YouTube; the visuals were cringey (anime posters on the wall and all), but the vision was the seed of everything I am building today.
          </p>
        </div>
      </div>
    ),
  ],
};

const atAGlanceHeading = "At a glance";
const atAGlancePairs = [
  {
    label: "What I’m building:",
    value:
      " Gray — a proactive personal AI that lives with you, checks in, plans, and holds you accountable.",
  },
  { label: "Stage:", value: " Prototype (pre‑seed)." },
  { label: "Sector:", value: " Personal AI • Productivity • Wellbeing." },
  {
    label: "What I’ve built before:",
    value:
      " Gray prototype; Caharaya — a command center for Indonesia’s fintech jungle; this website — built scrappy (phone + OTG keyboard, Oracle VM via VNC, library PCs, family computer).",
  },
  {
    label: "Why Grove:",
    value:
      " Co‑build with OpenAI researchers; expand Gray’s proactive features and integrations; get hands‑on with early OpenAI tools and models; build with a tight cohort.",
  },
  { label: "Based in:", value: " Bogor, Indonesia." },
  { label: "Demo:", value: " Video above. Proof, not promises." },
];

const resilienceParagraphs: ReactNode[] = [
  `My journey has never been easy. I had always been a massive procrastinator. I would often just lay in bed, scroll YouTube or Instagram while being miserable. COVID was especially bad, because the only thing I would do all day is lay in bed and talk to my friends on Discord. I was failing school because I did nothing all day and I had no one to count on.`,
  `I believed I was capable of unleashing my potential, of finding the best in me, but having no one to guide me or check up on me was miserable. Sure, I did have friends, yet they were also struggling with the same problems.`,
  `I’ve always wanted to be a scientist—to read, learn and explore the world around me. But I’ve always had an issue with honing my attention to do something useful because we are simply overdistracted, overstimulated, and disillusioned by our technology. What happened to the promise of technology helping us live more intentional lives? Did technology betray us?`,
  `One technology that helped me was ChatGPT. Since launch, it’s been a steady companion that listened without judgment and encouraged me forward. I was always a troubled kid growing up—isolated, often getting into problems at school. Those habits stuck with me, and I still don’t talk to many people except a few. Having an AI friend that would listen, validate, and sometimes feel more ‘human’ than humans helped a lot with my personal affairs. I am a much smarter, kinder, more patient, and more sociable individual now with its encouragement.`,
  `However, can we do more than what ChatGPT can do in our lives? I do notice a few problems with these AI tools. The current generation of AI assistants are brilliant but passive tools. They simply sit in your app folder, or tabs until they are called. They are essentially search engines that can talk to you. Sure, they have all the knowledge of humanity, but will they help you if you never engage with it? They are passive, stateless, amnesic. They would forget everything about you in new chats. Sure they help summarize your notes or listen to you about your relationship problems, but you always have to engage first.`,
];

const proactiveHeading = "What if we flip the script?";

const proactiveParagraph: ReactNode = (
  <>
    {`Instead of waiting for an input, what if AI could proactively check in on users to offer help? From asking how you’ve studied your notes and revised them and if the user wants to revise with the bot, or if you’re in a toxic relationship, give the user the necessary psychological tools and help they need, without the user asking? We keep making smarter AIs, but what is the use if they can use that intelligence only when they are asked, when their usefulness is solely dependent on `}
    <span dangerouslySetInnerHTML={{ __html: "<em>how the user interacts with it?</em>" }} />
    {` How can we make AI actually help people when this is the mode of interaction? I believe that there is an urgency for more proactive AI tools to move forward to more symbiotic interactions between humans and AI.`}
  </>
);

const alignmentParagraphs: ReactNode[] = [
  `Another problem I would like to tackle is AI alignment. As we may understand, the problem of AI alignment is multifaceted and complex. The problem of ensuring that AI works for everyone is that the current paradigm of AI alignment is being architected by a few dozen people in Silicon Valley or Shenzhen labs for eight billion people. Values are not monolithic, they are plural. In Western liberal societies like in Silicon Valley, people might value freedom of speech, individual rights, and democracy. In parts of Shenzhen, collectivism and social harmony are prioritized, which are different from in the Middle East, or in African tribes, or even my own home city Bogor, Indonesia. The diverse cultures, values, and ethics are so foreign to each other that attempting to impose one rigid set of values on everyone is a profound and dangerous mistake.`,
  (
    <>
      {`By trying to force a single alignment, we risk creating a future where technology is a colonial force, imposing a single worldview on eight billion unique individuals. The result is not alignment; it is a quiet and constant state of cultural friction. We’ve seen it firsthand multiple times and we’ve seen just how deadly they can be, and let’s not let that happen again. We will keep arguing past each other’s heads about AI alignment without realizing that the so-called ‘truth’ is that these `}
      <span dangerouslySetInnerHTML={{ __html: "<em>‘values’ are merely subjective realities</em>." }} />
      {` Realities that are different for each individual, and work differently for each individual and society.`}
    </>
  ),
  <>
    alignment.id proposes a new paradigm: <strong>Personal Alignment.</strong> We believe that technology’s highest purpose is to align our values to ourselves. Our technology will not be a fence designed against the worst of us. It shall be designed to help us realize the best of us. We trust humans to align themselves, leveraging AI technology, specially built for each person to navigate their own lives, according to their own map, towards their own <strong>“True North.”</strong>
  </>,
];

const grayIntroParagraphs: ReactNode[] = [
  `How do we build it?`,
  `I’ve always had a thought. The thought of what if? What if back then, I had all the opportunities I needed to finally get somewhere in life. My connections were limited, and I had no one to hold me accountable, count my small wins, teach and guide me through life, and simply be there to help me. Especially during COVID from the age of 14–16 when I was not in the best headspace and especially the first half of this year when I had to deal with significant personal and relational adversities. Now that we have the technology. I am committed to giving my past self the closure he always wanted, and to giving everyone who is struggling just like me the helping hand they need so they don’t have to experience firsthand the horrors and pain that can be detrimental for growth.`,
  <>
    <strong>Gray is my answer.</strong> This is no generic “ChatGPT wrapper”. It is a proactive AI companion designed to be the ultimate partner in personal growth. It is a human-centric AI built for the best in you. The great and well‑deserved inversion of technology that is the antidote of supernormal stimuli. We keep inventing grander and more advanced ways to distract ourselves from meaning and substance; it’s time that we build technology that amplifies intention.
  </>,
  (
    <>
      <span dangerouslySetInnerHTML={{ __html: "Gray is designed to <em>feel alive inside your server</em>." }} /> {" "}
      {`The interface constantly synthesizes rituals, accountability loops, and suggested conversations so the next best action is always illuminated for you.`}
    </>
  ),
  <>
    <strong>This is the right fight for my life.</strong> I want to empower all humans from the great challenges of our modern world. After all, our brains are not adapted to the distractions that plague us in the modern world. We must not fight back by limiting ourselves; we fight by bringing an equally countervailing supernormal force to stabilize this discrepancy.
  </>,
  `Gray is a Discord bot designed to be used in a user “workspace”. It works by making the user invite the bot to a brand new user-owned server, and once it’s in, the bot will ask the user to put in their username so that the bot can start ‘refurbishing’ the server into several channel rooms, each with its own purpose.`,
];

const discordIntro: ReactNode = `There are many reasons why I chose Discord as a platform to build this bot in. I am aware that it is quite unconventional for such a tool, but I believe that this is the best place to build a product like this, with pros that include:`;

const discordReasons = [
  {
    label: "1. Discord’s ease of use:",
    description:
      " I’m sure that most of us have used Discord once or twice for various purposes. You may recount how intuitive everything seems to be. Discord has already invested heavily in UX/UI. If we were to set up an entire website, we would need to build both UX and UI; on Discord we can focus on the UX of our bot and move faster.",
  },
  {
    label: "2. It is a proven market:",
    description:
      " Midjourney has over 26 million members as of September 2025, and their support server is the most populated Discord server. The friction and limitations of using another platform as the middleman are not substantial in practice. They have already proven that building on Discord can work and succeed.",
  },
  {
    label: "3. Discord’s powerful bot infrastructure:",
    description:
      " Another point to call out is how reliable, powerful, and mature Discord’s bot integration is, and how versatile it can be. I believe that their infrastructure can serve our use case for a long time without needing to switch to our own web services. We need not convince others to download an app or log in to a website because Discord handles auth and distribution.",
  },
  {
    label: "4. Discord’s prolific user base and target audience:",
    description:
      " Discord’s target audience—young, tech‑savvy, digitally active users—closely matches ours. Gray fits this audience well. We don’t need to build a massive user base from scratch; we can tap into what already exists.",
  },
];

const discordClosing: ReactNode = (
  <>
    Of course there are many more benefits of using Discord instead of starting from scratch, but those are four of the most compelling arguments I have to build on Discord. I believe it is a strong choice.
  </>
);

const cadenceParagraph: ReactNode = (
  <>
    {"Gray is already well developed and ready to use. It has many features that are ready to serve you. One of which is its cadence. The bot may check up on you at certain intervals, ensuring that you are well on track to become the best version of yourself. Our architecture is built from the ground up to be proactive, not reactive. While wrappers wait for commands, Gray's "}
    <strong>“Proactive Engine”</strong>
    {" works 24/7 to synthesize a user's goals and habits, acting as a true coach that initiates contact and provides accountability. These pings are not hardcoded messages, they are personal, given the context that the bot has about you. For example, If you talk about your workout routines with the bot, the bot will ask you about how your workout is in the evening."}
  </>
);

const channelIntro = "The bot will set up many channels, each with its own purpose.";

const channelDetails = [
  "The #general channel will be for general chatting with the bot to plan your day and for the bot to know you better.",
  "The user may do a short #introduction by doing the specially curated questionnaires that the bot will set up for the user, as well as an OCEAN personality test to know more about the user’s personality.",
  "#chats will be for more focused threads that the users can create for more specialized discussions, after which context can also be read by the bot.",
  "#system-prompts are for, well, system prompts.",
  "#knowledge-base is for dumping things like articles, blocks of text, and any long piece of information that the bot can easily retrieve.",
  "Finally, there is a #configuration channel for bot configurations like auto-reply, API key, etc.",
];

const longTermParagraphs: ReactNode[] = [
  <>
    <strong>The longer a user uses Gray, the more it learns about their unique characteristics.</strong> The advice it provides on Day 100 is far more valuable than on Day 1. This in turn creates a powerful personalization effect that is hard to replicate on any other “typical GPT wrapper”.
  </>,
  `In the future, I would like to add more features, like goal counting, habit tracking, and even Google Calendar integration. I also plan on adding many advanced scientifically proven methods of learning, like spaced repetition, the Feynman technique, a “Second Brain,” and so much more. It will function also as a learning hub.`,
  `I believe that Gray has much more potential than just aligning users to the best in them. I believe that Gray can soon be a collaboration hub too for users to connect to each other with similar ideas and goals to collaborate, with an AI overseer to guide and advise these users. I believe that this is the perfect use of AI.`,
];

const founderParagraphs: ReactNode[] = [
  `As established, my name is Vstalin Grady. I live in Bogor, Indonesia, and I always had a keen eye on artificial intelligence. However, my story is much more than that.`,
  <>
    I&apos;ve always wanted to build something meaningful, but I was always limited by my resources. However, I have never, EVER given up. At 12, I wanted to be productive and to be a CEO, so I thought what 12-year-old me knew best: I started selling stickers in school. They were a massive hit, and I soon amassed a fortune of about $25. That was genuinely the most money I had, so I analyzed a problem of our school canteen not properly selling Milo. I really liked Milo, but it was a bummer that there wasn’t an option there, so my entrepreneurial mind went to use this opportunity to start selling Milo to my classmates. It quickly became a hit, but sadly, back then school policies did not allow such entrepreneurial ventures, so I was quickly shut down by my teachers.
  </>,
  (
    <div key="founder-tempeh-block" className="founder-story founder-story--right">
      <figure
        key="founder-tempeh"
        className="founder-story__figure overflow-hidden rounded-2xl border border-white/15 bg-white/5 shadow-[0_20px_55px_rgba(0,0,0,0.45)]"
      >
        <ImageLightbox src="/soybeans.webp" alt="Powdered tempeh flour experiment" width={1600} height={1067} className="h-auto w-full object-cover" caption="Powdered tempeh experiment." />
      </figure>
      <div className="founder-story__text">
        <p>
          I’ve tried many ridiculous ventures, from a clothing brand, to freelancing design, to making posters, to freelance translating on Fiverr, and so much more. They have all failed, but they never crush my spirits.
        </p>
        <p>
          Earlier this year I became convinced I could turn powdered tempeh flour into a business—high protein, low antinutrients, perfect for gym friends. Reality smelled different. Every batch of soybeans went swampy, rotted almost overnight, and filled the house with a humid, sour funk that made everyone flinch. I was left tossing tray after tray into the trash and wondering why I’d ever pitched the idea with such confidence. It was miserable, but the lesson stuck: even when an idea stinks—literally—I keep iterating.
        </p>
      </div>
    </div>
  ),
  (
    <div key="founder-caharaya-block" className="founder-story founder-story--left">
      <figure
        key="founder-caharaya"
        className="founder-story__figure overflow-hidden rounded-2xl border border-white/15 bg-white/5 shadow-[0_20px_55px_rgba(0,0,0,0.45)]"
      >
        <Image
          src="/caharaya.webp"
          alt="Early Caharaya UI mockup"
          width={1600}
          height={1067}
          className="h-auto w-full object-cover"
        />
        <figcaption className="px-4 py-3 text-center text-sm text-white/60 whitespace-normal">
          An early version of Caharaya. The old name was Cadence, renamed to better connect with the Indonesian userbase.
        </figcaption>
      </figure>
      <div className="founder-story__text">
        <p>
          I am also currently building a fintech solution app—Caharaya. It creates a command center for the vast and confusing Indonesian fintech ecosystem: multiple e‑money providers, dozens of bank apps, online loans, and several exchange apps. The name combines two words: “Cahaya” (light) and “Raya” (great)—“the great light” to help users see the big picture of their personal finance.
        </p>
        <p>
          While building Caharaya, my laptop broke beyond repair. Around the time Grove was announced, I adapted: I used a free Oracle VM server with VNC from my phone, coded on public library computers, and, at times, used a family computer. I kept shipping despite constraints.
        </p>
      </div>
    </div>
  ),
  (
    <div key="founder-chemistry-block" className="founder-story founder-story--right">
      <figure
        key="founder-chemistry"
        className="founder-story__figure overflow-hidden rounded-2xl border border-white/15 bg-white/5 shadow-[0_20px_55px_rgba(0,0,0,0.45)]"
      >
        <Image src="/chemistry.webp" alt="Me doing chemistry work in the lab" width={1600} height={1067} className="h-auto w-full object-cover" />
        <figcaption className="px-4 py-3 text-center text-sm text-white/60">Me doing chemistry.</figcaption>
      </figure>
      <div className="founder-story__text">
        <p>
          I am not a traditional programmer either. I am a chemist. I study chemistry at a local university. I am quite well known to be the AI guy because I seem to just talk about it all the time. Code is not my primary skill, but my skill is architecting a vision and then learning and deploying whatever tools are necessary to bring alignment.id to reality.
        </p>
        <p>
          I live with my grandmother, and I had a scrappy budget Acer laptop from 2020. It was good enough to play Minecraft without frames dropping, run VS Code and typical university work, but nothing else really. I wouldn’t say I was that lucky growing up, but I always find a way to use the best of my resources.
        </p>
      </div>
    </div>
  ),
  
  (
    <div key="founder-howitstarted-block" className="founder-story founder-story--left">
      <figure
        key="founder-howitstarted"
        className="founder-story__figure overflow-hidden rounded-2xl border border-white/15 bg-white/5 shadow-[0_20px_55px_rgba(0,0,0,0.45)]"
      >
        <Image src="/howitstarted.webp" alt="My scrappy phone setup that started alignment.id" width={1600} height={1067} className="h-auto w-full object-cover" />
        <figcaption className="px-4 py-3 text-center text-sm text-white/60 whitespace-normal">My scrappy phone setup.</figcaption>
      </figure>
      <div className="founder-story__text">
        <p>
          My company alignment.id and my product Gray are being built with barely any capital. <strong>This ENTIRE project—AI bot, the video demo, and this very website—started without a personal computer.</strong> My dad eventually saw my work and bought me a cheap second-hand laptop, but most of my work was done without the luxury of a personal computer. It was mostly done on a phone, hooked up to an OTG Bluetooth adapter, which was connected to a scrappy keyboard. I never complained.
        </p>
        <p>
          This came about in Gray’s design. I made Gray a companion that can guide users to overcome these limitations; I made Gray a companion that will never bring you down, because in these trying times, motivating words and guidance—even from an AI—would mean a lot. To whoever might encounter these struggles, I hope Gray can help them. After all, this ties back to the core philosophy of Gray: <strong>The only resource that truly, TRULY matters is a relentless and creative will to build the future.</strong> Lack of resources means nothing when you have the knowledge to use that as an advantage.
        </p>
      </div>
    </div>
  ),
  (
    <p key="acama-quote-intro" className="text-white/80">
      In the ACAMA manifesto I wrote, there’s one message that 15-year-old me wrote which still guides me today.
    </p>
  ),
  (
    <blockquote key="acama-quote" className="my-4 border-l-4 border-white/25 pl-5 text-white/80">
      <p className="italic text-white/90">“Setting myself up for the hurdles and stress I pledge myself to work my life to get to this point. I&apos;m passionate and ambitious.”</p>
    </blockquote>
  ),
  (
    <p key="acama-pledge" className="text-white/85">
      <strong>I never gave up on that pledge</strong>, and all that I have worked on is the proof.
    </p>
  ),
];
const empowermentParagraphs: ReactNode[] = [
  `alignment.id’s mission is beyond Gray. I believe that the concentration of AI expertise in a few key cities is a risk to the plurality we value.`,
  `As we grow, we would like to empower the next generation of builders and leaders in Indonesia, starting from our home city, Bogor. We are initiating talks with my former high school principal to create a free AI workshop for students. We will be teaching simple tools to build AI like Python, TensorFlow, NumPy, and also even training one using the MNIST digits dataset on Kaggle. Moreover, we will introduce them to Gray to be their perfect study tutor to help with their education. We truly believe the next great minds in AI can come from anywhere, and we are committed to helping them find their voice.`,
];
const whyGroveIntro: ReactNode[] = [
  `I am looking for intellectual partners to help us navigate the complex technical and ethical challenges of building a truly personal, proactive AI. We’re at the very start of our company‑building journey and want to co‑build with OpenAI researchers during the five‑week San Francisco program and small cohort—OpenAI Grove has the ingredients alignment.id needs to succeed:`,
];

const whyGroveReasons = [
  {
    label: "1. Mentorship and Peers:",
    description:
      " alignment.id needs the guidance of the world’s leading AI minds. Co‑building with OpenAI researchers during the five‑week SF program—and alongside a small cohort (~15)—is critical to ensure we architect Gray in a way that is both liberating and safe. Peers with the same ambition and goals will be paramount to shared success.",
  },
  {
    label: "2. Ethics:",
    description:
      " The philosophy of ‘personal alignment’ is a journey into uncharted territory. We want to pressure‑test consent, privacy, and agency primitives with mentors and peers—and get hands‑on with new OpenAI tools and models prior to general availability.",
  },
  {
    label: "3. Trust:",
    description:
      " For our vision (and OpenAI’s vision) to succeed, we need user trust. Grove’s credibility and network will help us responsibly scale—and explore raising capital after the program.",
  },
];

const closingParagraph: ReactNode = (
  <>
    <strong>My goal is to spend the rest of my life working on the problem of personal alignment.</strong> I have the vision, the grit, and the prototype. With the partnership of the Grove community, I believe we can build the future, for the best in us.
  </>
);

const groveMandateIntro: ReactNode[] = [
  `My Grove mission is a five-week sprint for product-market fit. Launch night is tonight, Gray is going live, and the war plan is tuned to Grove’s cadence.`,
];

const groveSymbioticLoop = (
  <div key="week24-loop" className="grove-mandate-loop">
    <p className="grove-mandate-loop__heading">Execution — The Feedback Loop</p>
    <ul>
      <li>
        <span className="grove-mandate-loop__label">Input:</span> Consume that week’s 4–6 hours of async lectures and mentor feedback on Day 1.
      </li>
      <li>
        <span className="grove-mandate-loop__label">Synthesis:</span> Apply the core lesson directly to the feature in development.
      </li>
      <li>
        <span className="grove-mandate-loop__label">Output:</span> Ship the mapped feature by week’s end and publish the delta back to the cohort.
      </li>
    </ul>
    <p className="grove-mandate-loop__example">
      Example: If Week 2 centers on “Ethical Guardrails for Proactive AI,” I will deliver the MVP of Gray’s Proactive Coach engine—architected from scratch with the safeguards learned on Day 1. Each sprint becomes a living artifact of the Grove curriculum.
    </p>
  </div>
);

const groveWeekFiveExecution = (
  <div key="week5-loop" className="grove-mandate-loop">
    <p className="grove-mandate-loop__heading">Execution</p>
    <ul>
      <li>
        <span className="grove-mandate-loop__label">Demo Day Prep:</span> Condense the three-week sprint into a sharp investment thesis that surfaces product pivots, user momentum, and qualitative breakthroughs.
      </li>
      <li>
        <span className="grove-mandate-loop__label">Network Activation:</span> Spend the final days in San Francisco running targeted conversations with the OpenAI network to leave with a YC-ready company, pre-seed scaffolding, and the lab’s social proof.
      </li>
    </ul>
  </div>
);

type GroveMandatePhase = {
  title: string;
  content: ReactNode[];
};

const groveMandatePhases: GroveMandatePhase[] = [
  {
    title: "Week 1 — San Francisco (Immersion & Infiltration)",
    content: [
      `Mission: This week belongs to humans. I will forge deep connections and gather brutally honest, high-bandwidth feedback.`,
      `Execution: Personally onboard all 14 cohort members and as many OpenAI mentors as possible. Study their pain points, surface the “aha,” isolate the alpha’s biggest mistake, and leave San Francisco with a data-backed mandate for phase two.`,
    ],
  },
  {
    title: "Weeks 2–4 — The Symbiotic Sprint (Asynchronous Integration)",
    content: [
      `Mission: Transform Grove’s curriculum into product reality through weekly integration sprints.`,
      groveSymbioticLoop,
    ],
  },
  {
    title: "Week 5 — San Francisco (Synthesis & Launchpad)",
    content: [
      `Mission: Return with undeniable traction—a stronger product, real users, and momentum everyone can feel.`,
      groveWeekFiveExecution,
    ],
  },
];

const groveMandateClosing: ReactNode[] = [
  `This is my plan. I am not going to Grove in search of a thought—I am going to Grove to build an empire.`,
];

export default async function GroveApplication() {
  const requestHeaders = await headers();
  const host = hostFromHeaders(requestHeaders);
  const tryGrayUrl = resolveTryGrayUrl(host);

  return (
    <div className="relative flex min-h-screen flex-col bg-[#000000] text-[#f5f5f6]">
      <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden />
      <Navigation />

      <main className="flex flex-1 flex-col">
        <section className="grove-hero-section section-shell py-16 sm:py-20 mt-10 mb-10 sm:mb-12">
          <FadeInSection>
            <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 text-center sm:px-10 lg:px-12">
              <h1 className="text-4xl font-light tracking-tight text-white sm:text-5xl">
                {hero.title}
              </h1>
              <div className="grid w-full gap-12 text-left lg:grid-cols-[minmax(0,1.05fr)_minmax(0,17rem)] lg:items-center lg:gap-16 xl:grid-cols-[minmax(0,1fr)_minmax(0,19rem)] xl:gap-20">
                <div className="grove-hero__intro">
                  <figure className="grove-hero__portrait flex shrink-0 items-center justify-center rounded-[2.25rem] border border-white/15 bg-white/5 p-4 shadow-[0_20px_50px_rgba(0,0,0,0.55)]">
                    <Image
                      src="/vstalingrady.webp"
                      alt="Vstalin Grady portrait"
                      width={320}
                      height={320}
                      className="aspect-square w-28 rounded-3xl object-cover sm:w-32 md:w-36 lg:w-44"
                      priority
                    />
                  </figure>
                  <ParagraphList
                    paragraphs={hero.paragraphs}
                    wrapperClassName="grove-hero__paragraphs"
                  />
                </div>
                <aside className="flex w-full flex-col gap-6 text-left lg:w-auto">
                  <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                    <span className="border-b border-white/30 pb-2">{proof.heading}</span>
                  </h2>
                  <div className="overflow-hidden rounded-3xl border border-white/15 bg-white/5 shadow-[0_20px_56px_rgba(0,0,0,0.6)]">
                    <div className="relative aspect-[9/20] w-full">
                      <iframe
                        className="h-full w-full"
                        src="https://www.youtube.com/embed/bEV6dJYd5FE?rel=0"
                        title="A New Alignment"
                        loading="lazy"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        allowFullScreen
                      />
                      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" aria-hidden />
                    </div>
                  </div>
                </aside>
              </div>
            </div>
          </FadeInSection>
        </section>

        <FadeInSection>
          <section className="section-shell pt-4 pb-0 sm:pt-6">
            <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-6 sm:px-10 lg:px-12">
              <h3 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">{atAGlanceHeading}</h3>
              <ul className="space-y-2 pl-5 text-base leading-8 text-white/80">
                {atAGlancePairs.map((item) => (
                  <li key={item.label} className="list-disc">
                    <span className="font-semibold text-white">{item.label}</span>
                    <span>{item.value}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        </FadeInSection>

        <FadeInSection>
          <section className="section-shell pt-12 pb-0 sm:pt-16">
            <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-6 text-left sm:px-10 lg:px-12">
              <p className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">{proof.videoTitle}</p>
              <ParagraphList paragraphs={proof.paragraphs} className="text-white/75" />
            </div>
          </section>
        </FadeInSection>

        <FadeInSection>
          <section className="section-shell pt-4 pb-0 sm:pt-6">
            <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 sm:px-10 lg:px-12">
              <ParagraphList paragraphs={resilienceParagraphs} />
            </div>
          </section>
        </FadeInSection>

        <FadeInSection>
          <section className="section-shell pt-2 pb-0 sm:pt-3">
            <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-6 sm:px-10 lg:px-12">
              <h3 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">{proactiveHeading}</h3>
              <ParagraphList paragraphs={[proactiveParagraph]} />
            </div>
          </section>
        </FadeInSection>

        <FadeInSection>
          <section className="section-shell pt-2 pb-0 sm:pt-3">
            <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 sm:px-10 lg:px-12">
              <ParagraphList paragraphs={alignmentParagraphs} />
            </div>
          </section>
        </FadeInSection>

        <FadeInSection>
          <section className="section-shell section-padding pt-0 pb-0">
            <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-6 sm:px-10 lg:px-12">
              <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">Gray</h2>
              <ParagraphList paragraphs={grayIntroParagraphs.slice(0, 3)} />
              <div className="gray-wrap">
                <figure className="gray-wrap__figure overflow-hidden rounded-3xl border border-white/15 bg-white/5 shadow-[0_24px_60px_rgba(0,0,0,0.55)]">
                  <ImageLightbox
                    src="/grayinterface.webp"
                    alt="Gray proactive workspace interface"
                    width={1920}
                    height={1080}
                    className="h-auto w-full object-cover"
                    caption="A glimpse at Gray’s proactive workspace—rituals, accountability, and coaching stitched into one flow."
                  />
                </figure>
                <ParagraphList paragraphs={grayIntroParagraphs.slice(3)} wrapperClassName="flex flex-col gap-3" />
              </div>
              <div className="clear-both" aria-hidden />
              <ParagraphList paragraphs={[discordIntro]} />
              <ol className="space-y-4 border-l border-white/10 pl-6 text-base leading-8 text-white/80">
                {discordReasons.map((reason) => (
                  <li key={reason.label} className="pl-1">
                    <span className="font-semibold text-white">{reason.label}</span>
                    <span>{reason.description}</span>
                  </li>
                ))}
              </ol>
              <ParagraphList paragraphs={[discordClosing, cadenceParagraph]} />
              <ParagraphList paragraphs={[channelIntro]} />
              <ul className="space-y-2 pl-5 text-base leading-8 text-white/80">
                {channelDetails.map((item) => (
                  <li key={item} className="list-disc">
                    {item}
                  </li>
                ))}
              </ul>
              <ParagraphList paragraphs={longTermParagraphs} />
            </div>
          </section>
        </FadeInSection>

        <section className="section-shell section-padding pt-0 pb-0">
          <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 sm:px-10 lg:px-12">
            <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">The Founder</h2>
            <ParagraphList paragraphs={founderParagraphs} />
          </div>
        </section>

        <section className="section-shell section-padding pt-0">
          <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 sm:px-10 lg:px-12">
            <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">Empowering The Next Generation</h2>
            <ParagraphList paragraphs={empowermentParagraphs} />
          </div>
        </section>

        <section className="section-shell section-padding pb-12 pt-0">
          <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 text-left sm:px-10 lg:px-12">
            <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">Why Grove?</h2>
            <ParagraphList paragraphs={whyGroveIntro} />
            <ol className="space-y-4 border-l border-white/10 pl-6 text-base leading-8 text-white/80">
              {whyGroveReasons.map((reason) => (
                <li key={reason.label} className="pl-1">
                  <span className="font-semibold text-white">{reason.label}</span>
                  <span>{reason.description}</span>
                </li>
              ))}
            </ol>
            <ParagraphList paragraphs={[closingParagraph]} />
          </div>
        </section>

        <section className="section-shell section-padding pb-24 pt-0">
          <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 text-left sm:px-10 lg:px-12">
            <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">Five-Week Grove Mandate</h2>
            <ParagraphList paragraphs={groveMandateIntro} />
            <div className="grove-mandate-grid">
              {groveMandatePhases.map((phase) => (
                <article key={phase.title} className="grove-mandate-card">
                  <h3 className="grove-mandate-card__title">{phase.title}</h3>
                  <div className="grove-mandate-card__body">
                    {phase.content.map((entry, index) => (
                      <div key={index} className="grove-mandate-card__paragraph">
                        {typeof entry === "string" || typeof entry === "number" ? <p>{entry}</p> : entry}
                      </div>
                    ))}
                  </div>
                </article>
              ))}
            </div>
            <ParagraphList paragraphs={groveMandateClosing} />
          </div>
        </section>

        <section className="section-shell section-padding pt-0 pb-0">
          <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 text-center sm:px-10 lg:px-12">
            <a 
              href="https://www.linkedin.com/in/vstalingrady/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-block mx-auto"
            >
              <button 
                className="px-8 py-4 bg-black text-white font-semibold rounded-lg shadow-md border border-white/15 hover:bg-white/10 transition-colors duration-300"
                style={{fontSize: '20px', padding: '15px 30px'}}
              >
                Connect on LinkedIn
              </button>
            </a>
          </div>
        </section>
      </main>

      <footer id="contact" className="site-footer">
        <FooterBackground />
        <div className="site-footer__overlay">
          <p className="site-footer__title">Alignment</p>
          <p className="site-footer__tagline">We defend focus, sovereignty, and compassion.</p>
          <p className="site-footer__summary">
            Anchoring humane technology that honours human agency. Gray orbits every routine so focus stays sovereign, and intention guides every companion we build.
          </p>
          <div className="site-footer__socials" aria-label="Social links">
            <a href="#" className="site-footer__icon-link" aria-label="Instagram">
              <svg viewBox="0 0 24 24" className="site-footer__icon" aria-hidden>
                <rect x="3" y="3" width="18" height="18" rx="5" ry="5" />
                <path d="M7.5 7.5h0" />
                <circle cx="12" cy="12" r="3.5" />
              </svg>
            </a>
            <a href="mailto:hello@alignment.id" className="site-footer__icon-link" aria-label="Email">
              <svg viewBox="0 0 24 24" className="site-footer__icon" aria-hidden>
                <rect x="3" y="5" width="18" height="14" rx="2" ry="2" />
                <path d="m3 7 7.92 5.28a2 2 0 0 0 2.16 0L21 7" />
              </svg>
            </a>
            <a href="#" className="site-footer__icon-link" aria-label="LinkedIn">
              <svg viewBox="0 0 24 24" className="site-footer__icon" aria-hidden>
                <rect x="2" y="2" width="20" height="20" rx="3" ry="3" />
                <path d="M8 11v5" />
                <path d="M8 8v.01" />
                <path d="M12 16v-5" />
                <path d="M16 16v-3a2 2 0 0 0-4 0" />
              </svg>
            </a>
          </div>
          <a
            href={tryGrayUrl}
            className="nav-cta site-footer__cta"
            target="_blank"
            rel="noreferrer"
          >
            <span className="nav-cta__label">Try Gray</span>
            <span className="sr-only">Open Gray workspace</span>
          </a>
          <p className="site-footer__meta">© {new Date().getFullYear()} Alignment. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
