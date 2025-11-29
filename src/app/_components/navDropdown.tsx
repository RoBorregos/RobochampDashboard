import Image from "next/image";
import Link from "next/link";
import menu from "rbrgs/../public/images/menu.svg";
import SignInButton from "./SignInButton";
import { Session } from "next-auth";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetClose,
} from "r/components/ui/sheet";
import { Role } from "@prisma/client";
import { StaticImport } from "next/dist/shared/lib/get-img-props";

export default function NavDropdown({ session }: { session: Session | null }) {
  return (
    <div className="block justify-self-end lg:hidden">
      <Sheet>
        <SheetTrigger asChild>
          <Image src={menu as StaticImport} alt="" className="flex h-5 w-5" />
        </SheetTrigger>
        <SheetContent
          className="flex w-screen flex-col justify-center bg-black text-white"
          side="top"
        >
          <SheetClose asChild>
            <Link href="/" className="w-full text-lg">
              Home
            </Link>
          </SheetClose>
          <SheetClose asChild>
            <Link href="/scoreboard" className="w-full text-lg">
              Scoreboard
            </Link>
          </SheetClose>
          <SheetClose asChild>
            <Link href="brackets" className="w-full text-lg">
              Brackets
            </Link>
          </SheetClose>
          {(session?.user.role === Role.ADMIN ||
            session?.user.role === Role.JUDGE) && (
            <SheetClose asChild>
              <Link href="/judge" className="w-full text-lg">
                Judge
              </Link>
            </SheetClose>
          )}
          {session?.user.role === Role.ADMIN && (
            <SheetClose asChild>
              <Link href="/admin" className="w-full text-lg">
                Admin
              </Link>
            </SheetClose>
          )}
          <SheetClose asChild>
            <Link href="https://www.roborregos.com" className="w-full text-lg">
              About Us
            </Link>
          </SheetClose>
          <SignInButton session={session} />
        </SheetContent>
      </Sheet>
    </div>
  );
}
