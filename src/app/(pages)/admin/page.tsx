"use client";

import Header from "~/app/_components/header";
import { api } from "~/trpc/react";
import LogoLoader from "~/app/_components/logo-loader";
import { useState } from "react";
import TeamManagement from "~/app/_components/admin/TeamManagement";
import TeamStatusManagement from "~/app/_components/admin/TeamStatusManagement";
import ScheduleControl from "~/app/_components/admin/ScheduleControl";
import RoundControl from "~/app/_components/admin/RoundControl";
import InterviewManagement from "~/app/_components/admin/InterviewManagement";
import StaffManagement from "~/app/_components/admin/StaffManagement";

export default function AdminPage() {
  const [selectedTab, setSelectedTab] = useState<
    "management" | "teams" | "schedule" | "rounds" | "interviews" | "staff"
  >("management");

  const { data: users, refetch: refetchUsers } =
    api.admin.getAllUsers.useQuery();
  const { data: teams, refetch: refetchTeams } =
    api.admin.getAllTeams.useQuery();
  const { data: pendingRequests, refetch: refetchRequests } =
    api.admin.getPendingRequests.useQuery();
  const { data: scheduleTeams, refetch: refetchScheduleTeams } =
    api.admin.getTeams.useQuery();
  const { data: config, refetch: refetchConfig } =
    api.admin.getConfig.useQuery();

  const refetchAll = () => {
    void refetchUsers();
    void refetchTeams();
    void refetchRequests();
    void refetchScheduleTeams();
    void refetchConfig();
  };

  if (!users || !teams || !pendingRequests || !scheduleTeams || !config)
    return <LogoLoader />;

  const activeTeams = scheduleTeams?.filter((team) => team.isActive) ?? [];

  return (
    <main className="min-h-screen bg-black text-sm text-white md:text-base">
      <div className="pt-16">
        <Header
          title="Administration Panel"
          subtitle="Complete system management"
        />
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-gray-700">
        <nav className="flex space-x-8 px-4">
          {[
            { id: "management", label: "Team Management" },
            { id: "teams", label: "Active Teams" },
            { id: "schedule", label: "Schedule Control" },
            { id: "rounds", label: "Round Control" },
            { id: "interviews", label: "Interview Management" },
            { id: "staff", label: "Staff" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() =>
                setSelectedTab(
                  tab.id as
                    | "management"
                    | "teams"
                    | "schedule"
                    | "rounds"
                    | "interviews"
                    | "staff",
                )
              }
              className={`border-b-2 px-1 py-2 text-sm font-medium ${
                selectedTab === tab.id
                  ? "border-roboblue text-roboblue"
                  : "border-transparent text-gray-300 hover:text-white"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="container mx-auto max-w-6xl space-y-6 p-4">
        {selectedTab === "management" && (
          <TeamManagement
            users={users}
            teams={teams}
            pendingRequests={pendingRequests}
            refetchAll={refetchAll}
          />
        )}

        {selectedTab === "teams" && (
          <TeamStatusManagement
            scheduleTeams={scheduleTeams}
            refetchScheduleTeams={refetchScheduleTeams}
          />
        )}

        {selectedTab === "schedule" && (
          <ScheduleControl
            activeTeams={activeTeams}
            config={config}
            refetchScheduleTeams={refetchScheduleTeams}
            refetchConfig={refetchConfig}
          />
        )}

        {selectedTab === "rounds" && (
          <RoundControl
            config={config}
            teams={teams}
            refetchConfig={refetchConfig}
          />
        )}

        {selectedTab === "interviews" && (
          <InterviewManagement refetchAll={refetchAll} />
        )}

        {selectedTab === "staff" && <StaffManagement />}
      </div>
    </main>
  );
}
