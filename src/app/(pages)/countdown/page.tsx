import Image from "next/image";
import { HydrateClient } from "rbrgs/trpc/server";
import Footer from "../../_components/footer";
import { CountdownTimer } from "../../_components/CountdownTimer";

export default async function Countdown() {
  const targetDate = new Date("2024-12-04T15:00:00Z");

  return (
    <HydrateClient>
      <main>
        <section className="relative flex min-h-[100vw] flex-col overflow-hidden lg:min-h-screen">
          <div className="z-10 mt-[45vw] text-center lg:mt-32">
            <h1 className="font-jersey_25 text-[13vw] leading-none text-roboblue lg:text-[12vw]">
              ROBOCHAMP
            </h1>
            <p className="mt-[-2vw] font-anton text-[6vw] text-white lg:text-[3vw]">
              By RoBorregos
            </p>
          </div>
          <div className="absolute left-1/2 top-1/2 -z-10 -translate-x-1/2 -translate-y-1/2 transform">
            <Image
              src="/images/white-logo.png"
              alt=""
              className="w-[40vw] object-cover opacity-15 lg:w-[40vw]"
            />
          </div>
          <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black to-transparent" />
          <Image
            src="/images/fronPic.jpg"
            alt=""
            layout="fill"
            objectFit="cover"
            className="-z-20 opacity-30"
            // the black fade is covering the image
          />

          <CountdownTimer targetDate={targetDate} className="mt-36" />
        </section>

        <Footer />
      </main>
    </HydrateClient>
  );
}
