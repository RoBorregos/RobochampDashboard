"use client";

import { api } from "~/trpc/react";
import { toast } from "sonner";
import { useState } from "react";

type UserDisplay = {
  id: string;
  name: string | null;
  email: string | null;
  role?: string;
  team?: { name: string } | null;
};

type TeamDisplay = {
  id: string;
  name: string;
  _count: { members: number };
  members: UserDisplay[];
  roster?: { id: string; name: string }[];
};

interface PendingRequest {
  id: string;
  user: UserDisplay;
  requestedTeam: string;
  message?: string | null;
}

interface TeamManagementProps {
  users?: UserDisplay[];
  teams?: TeamDisplay[];
  pendingRequests?: PendingRequest[];
  refetchAll: () => void;
}

export default function TeamManagement({
  users,
  teams,
  pendingRequests,
  refetchAll,
}: TeamManagementProps) {
  const [newTeamName, setNewTeamName] = useState<string>("");
  const [userTeamSelections, setUserTeamSelections] = useState<
    Record<string, string>
  >({});

  const assignUser = api.admin.assignUserToTeam.useMutation({
    onSuccess() {
      toast("User assigned successfully!");
      refetchAll();
    },
    onError(error) {
      toast("Error assigning user");
      console.error(error);
    },
  });

  const importCsv = api.admin.importSelectionCsv.useMutation({
    onSuccess(r) {
      toast(`Imported ${r.teams} teams and ${r.members} members.`);
      refetchAll();
    },
    onError(error) {
      toast(`Import failed: ${error.message}`);
    },
  });

  // Excel saves this CSV as Windows-1252, so fall back when it is not UTF-8.
  const handleCsvFile = async (file: File) => {
    const buffer = await file.arrayBuffer();
    let text: string;
    try {
      text = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
    } catch {
      text = new TextDecoder("windows-1252").decode(buffer);
    }
    importCsv.mutate({ csv: text });
  };

  const removeUser = api.admin.removeUserFromTeam.useMutation({
    onSuccess() {
      toast("User removed from team successfully!");
      refetchAll();
    },
    onError(error) {
      toast("Error removing user from team");
      console.error(error);
    },
  });

  const createTeam = api.admin.createTeam.useMutation({
    onSuccess() {
      toast("Team created successfully!");
      setNewTeamName("");
      refetchAll();
    },
    onError(error) {
      toast("Error creating team");
      console.error(error);
    },
  });

  const approveRequest = api.admin.approveTeamRequest.useMutation({
    onSuccess() {
      toast("Request approved!");
      refetchAll();
    },
    onError(error) {
      toast("Error approving request");
      console.error(error);
    },
  });

  const rejectRequest = api.admin.rejectTeamRequest.useMutation({
    onSuccess() {
      toast("Request rejected!");
      refetchAll();
    },
    onError(error) {
      toast("Error rejecting request");
      console.error(error);
    },
  });

  const getDisplayName = (user: UserDisplay) => user.name ?? user.email;

  const isTeamFull = (teamName: string) => {
    const team = teams?.find((t: TeamDisplay) => t.name === teamName);
    return team && team._count.members >= 4;
  };

  const handleTeamSelection = (userId: string, teamName: string) => {
    setUserTeamSelections((prev) => ({
      ...prev,
      [userId]: teamName,
    }));
  };

  const handleAssignUser = (userId: string) => {
    const selectedTeam = userTeamSelections[userId];
    if (selectedTeam) {
      if (isTeamFull(selectedTeam)) {
        toast("Team is full. Maximum 4 members allowed.");
        return;
      }
      assignUser.mutate({ userId, teamName: selectedTeam });
      setUserTeamSelections((prev) => {
        const newSelections = { ...prev };
        delete newSelections[userId];
        return newSelections;
      });
    }
  };

  const handleRemoveUser = (
    userId: string,
    userName: string | null,
    userEmail: string | null,
  ) => {
    const displayName = userName ?? userEmail;
    if (
      window.confirm(
        `Are you sure you want to remove ${displayName} from their team?`,
      )
    ) {
      removeUser.mutate({ userId });
    }
  };

  const handleCreateTeam = () => {
    if (!newTeamName.trim()) {
      toast("Please enter a team name");
      return;
    }
    createTeam.mutate({ name: newTeamName.trim() });
  };

  return (
    <>
      {pendingRequests && pendingRequests.length > 0 && (
        <div className="rounded-lg bg-yellow-900 p-6">
          <h3 className="mb-4 text-xl font-semibold">Pending Team Requests</h3>
          <div className="space-y-3">
            {pendingRequests?.map((request) => (
              <div
                key={request.id}
                className="flex items-center justify-between rounded bg-yellow-800 p-4"
              >
                <div>
                  <p className="font-semibold">
                    {getDisplayName(request.user)}
                  </p>
                  {request.user.name && (
                    <p className="text-sm text-gray-400">
                      {request.user.email}
                    </p>
                  )}
                  <p className="text-sm text-gray-300">
                    Requested team: {request.requestedTeam}
                  </p>
                  {request.message && (
                    <p className="text-sm text-gray-400">
                      Message: {request.message}
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() =>
                      approveRequest.mutate({ requestId: request.id })
                    }
                    className="rounded bg-green-600 px-3 py-1 hover:bg-green-700"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() =>
                      rejectRequest.mutate({ requestId: request.id })
                    }
                    className="rounded bg-red-600 px-3 py-1 hover:bg-red-700"
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-lg bg-gray-800 p-6">
        <h3 className="mb-4 text-xl font-semibold">Create New Team</h3>
        <div className="flex gap-4">
          <input
            type="text"
            placeholder="Team name"
            value={newTeamName}
            onChange={(e) => setNewTeamName(e.target.value)}
            className="flex-1 rounded border border-gray-600 bg-gray-700 p-2"
          />
          <button
            onClick={handleCreateTeam}
            disabled={createTeam.isPending}
            className="rounded bg-blue-600 px-4 py-2 hover:bg-blue-700 disabled:opacity-50"
          >
            {createTeam.isPending ? "Creating..." : "Create Team"}
          </button>
        </div>
      </div>

      <div className="rounded-lg bg-gray-800 p-6">
        <h3 className="mb-2 text-xl font-semibold">Import Selection CSV</h3>
        <p className="mb-4 text-sm text-gray-400">
          Replaces the current roster. Columns: Nombre completo, Equipo,
          Categoría, Coach, Prepa, Asistió.
        </p>
        <input
          type="file"
          accept=".csv,text/csv"
          disabled={importCsv.isPending}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleCsvFile(file);
            e.target.value = "";
          }}
          className="text-sm"
        />
      </div>

      <div className="rounded-lg bg-gray-800 p-6">
        <h3 className="mb-4 text-xl font-semibold">Users Without Teams</h3>
        <div className="space-y-3">
          {users
            ?.filter((user) => !user.team && user.role !== "ADMIN")
            .map((user) => (
              <div
                key={user.id}
                className="flex items-center justify-between rounded bg-gray-700 p-4"
              >
                <div>
                  <p className="font-semibold">{getDisplayName(user)}</p>
                  {user.name && (
                    <p className="text-sm text-gray-500">{user.email}</p>
                  )}
                  <p className="text-sm text-gray-400">Role: {user.role}</p>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={userTeamSelections[user.id] ?? ""}
                    onChange={(e) =>
                      handleTeamSelection(user.id, e.target.value)
                    }
                    className="rounded border border-gray-500 bg-gray-600 p-2"
                  >
                    <option value="">Select team</option>
                    {teams?.map((team) => (
                      <option
                        key={team.id}
                        value={team.name}
                        disabled={isTeamFull(team.name)}
                      >
                        {team.name} ({team._count.members}/4)
                        {team._count.members >= 4 ? " - Full" : ""}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => handleAssignUser(user.id)}
                    disabled={
                      !userTeamSelections[user.id] ||
                      assignUser.isPending ||
                      isTeamFull(userTeamSelections[user.id] ?? "")
                    }
                    className="rounded bg-green-600 px-3 py-2 hover:bg-green-700 disabled:opacity-50"
                  >
                    Assign
                  </button>
                </div>
              </div>
            ))}
        </div>
      </div>

      <div className="rounded-lg bg-gray-800 p-6">
        <h3 className="mb-4 text-xl font-semibold">Teams Overview</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {teams?.map((team) => (
            <div key={team.id} className="rounded bg-gray-700 p-4">
              <h4 className="mb-2 font-semibold">{team.name}</h4>
              <p className="mb-2 text-sm text-gray-400">
                Members: {(team._count?.members ?? 0) + (team.roster?.length ?? 0)} / 4
                {(team._count?.members ?? 0) + (team.roster?.length ?? 0) >= 4
                  ? " - Full"
                  : ""}
              </p>
              <div className="space-y-2">
                {team.members?.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between rounded bg-gray-600 p-2 text-sm"
                  >
                    <div className="flex-1">
                      <div className="font-medium">
                        {getDisplayName(member)}
                      </div>
                      {member.name && (
                        <div className="text-xs text-gray-400">
                          {member.email}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() =>
                        handleRemoveUser(member.id, member.name, member.email)
                      }
                      disabled={removeUser.isPending}
                      className="ml-2 rounded bg-red-500 px-2 py-1 text-xs hover:bg-red-600 disabled:opacity-50"
                      title={`Remove ${getDisplayName(member)} from team`}
                    >
                      {removeUser.isPending ? "..." : "x"}
                    </button>
                  </div>
                ))}
                {team.roster?.map((person) => (
                  <div
                    key={person.id}
                    className="rounded bg-gray-600 p-2 text-sm font-medium"
                  >
                    {person.name}
                  </div>
                ))}
                {!team.members?.length && !team.roster?.length && (
                  <p className="text-sm italic text-gray-500">No members</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
