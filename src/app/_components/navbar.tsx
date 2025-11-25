import SignInButton from "./SignInButton";
import { getServerAuthSession } from "rbrgs/server/auth";
import NavDropdown from "./navDropdown";
import Link from "next/link";
import Image from "next/image";
import robologo from "r/../public/images/white-logo.png";
import { Role } from "@prisma/client";

export default async function Navbar() {
  const session = await getServerAuthSession();

  const canJudge =
    session?.user.role === Role.JUDGE || session?.user.role === Role.ADMIN;

  return (
    <nav className="fixed top-0 z-50 grid h-[4rem] w-screen grid-cols-2 items-center bg-black px-[3rem] font-archivo lg:grid-cols-[auto_1fr_auto]">
      <Link href="/">
        <Image
          src={robologo}
          alt="Logo"
          className="h-[2rem] w-fit cursor-pointer object-contain"
        />
      </Link>
      <div className="ml-10 hidden w-full items-center justify-start gap-x-10 text-white lg:flex xl:text-xl">
        <Link href="scoreboard">Scoreboard</Link>
        <Link href="schedule">Schedule</Link>
        <Link href="team">Team</Link>
        {canJudge && <Link href="judge">Judge</Link>}
        {session?.user.role === Role.ADMIN && <Link href="admin">Admin</Link>}
        <Link href="editions">Past Editions</Link>
        <Link href="https://www.roborregos.com">About us</Link>
      </div>
      <div className="hidden lg:block">
        <SignInButton session={session} />
      </div>
      <NavDropdown session={session} />
    </nav>
  );
}
