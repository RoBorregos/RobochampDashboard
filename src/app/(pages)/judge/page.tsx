"use client";

import { FormChallengeA } from "../forms/FormChallengeA";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/app/_components/shadcn/ui/select";
import Header from "rbrgs/app/_components/header";
import { useState } from "react";
import { useSession } from "next-auth/react";
import { Role } from "@prisma/client";

export default function JudgePage() {
  const [selected, setSelected] = useState("Sin seleccionar");

  const session = useSession();

  if (
    session.data?.user?.role !== Role.ADMIN &&
    session.data?.user?.role !== Role.JUDGE
  ) {
    return (
      <main className="mt-[4rem] h-96 bg-black text-sm text-white md:text-base">
        <div className="md:pb-20">
          <Header title="Judge" subtitle="" />
        </div>
        <div className="p-2">
          <h1 className="mb-5 text-center text-4xl">
            You don&apos;t have permission to access this page.
          </h1>
        </div>
      </main>
    );
  }

  return (
    <main className="mt-[4rem] h-96 bg-black text-sm text-white md:text-base">
      <div className="md:pb-20">
        <Header title="Judge" subtitle="" />
      </div>
      <div className="p-2">
        <h1 className="mb-5 text-center text-4xl">Seleccionar Reto</h1>
        <div className="mx-auto lg:w-1/2">
          <Select
            onValueChange={(value) => {
              setSelected(value);
            }}
            value={selected}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecciona un reto" />
            </SelectTrigger>

            <SelectContent>
              <SelectItem value="challengeA" className="cursor-pointer">
                Pista
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="">
          <ShowForm selection={selected} />
        </div>
      </div>
    </main>
  );
}

const ShowForm = ({ selection }: { selection: string }) => {
  switch (selection) {
    case "challengeA":
      return (
        <ChallengeWrapper>
          <FormChallengeA />
        </ChallengeWrapper>
      );
    default:
      return <></>;
  }
};

const ChallengeWrapper = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="m-8 mx-auto rounded border border-white p-3 shadow-lg lg:w-1/2">
      {children}
    </div>
  );
};
