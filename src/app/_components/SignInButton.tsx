"use client";

import type { Session } from "next-auth";
import { signIn, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "r/components/ui/avatar";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "r/components/ui/navigation-menu";

export default function SignInButton({ session }: { session: Session | null }) {
  const router = useRouter();

  if (!session) {
    return (
      <div className="flex items-center justify-end">
        <button
          type="button"
          className="w-fit cursor-pointer rounded-md p-2 px-6 text-xl font-semibold text-white transition duration-300 hover:bg-slate-100 hover:bg-opacity-10"
          onClick={() => signIn("google")}
        >
          Log in
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-[3rem] items-center justify-end">
      <NavigationMenu>
        <NavigationMenuList>
          <NavigationMenuItem>
            <NavigationMenuTrigger
              className="items-center bg-transparent align-middle data-[active]:bg-transparent data-[state=open]:bg-transparent hover:bg-transparent focus:bg-transparent focus:outline-none"
              onClick={() => {
                router.push("/account");
              }}
            >
              <Avatar className="h-[2rem] w-[2rem]">
                <AvatarImage src={session.user.image ?? undefined} />
                <AvatarFallback>{session.user.name?.at(0)}</AvatarFallback>
              </Avatar>
              <div className="items-center self-center py-1 text-start align-middle text-white hover:text-rbrgs-blue">
                <p className="ml-2">{session.user.name}</p>
                <p className="ml-2 text-sm">
                  {session.user.role[0]! +
                    session.user.role.slice(1).toLocaleLowerCase()}
                </p>
              </div>
            </NavigationMenuTrigger>
            <NavigationMenuContent>
              <NavigationMenuLink className="w-[250px] bg-black" asChild>
                <div>
                  <Link href="/account">
                    <div className="cursor-pointer rounded-md p-2 px-6 text-sm text-white hover:bg-slate-100 hover:bg-opacity-10">
                      Account
                    </div>
                  </Link>
                  <button
                    type="button"
                    className="w-full cursor-pointer rounded-md p-2 px-6 text-left text-sm text-white hover:bg-slate-100 hover:bg-opacity-10"
                    onClick={() => signOut()}
                  >
                    Log out
                  </button>
                </div>
              </NavigationMenuLink>
            </NavigationMenuContent>
          </NavigationMenuItem>
        </NavigationMenuList>
      </NavigationMenu>
    </div>
  );
}
