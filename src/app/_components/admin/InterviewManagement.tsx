"use client";

import { api } from "~/trpc/react";
import { toast } from "sonner";
import { useState } from "react";

interface InterviewManagementProps {
  refetchAll: () => void;
}

export default function InterviewManagement({
  refetchAll,
}: InterviewManagementProps) {
  const [selectedArea, setSelectedArea] = useState<
    "MECHANICS" | "ELECTRONICS" | "PROGRAMMING"
  >("MECHANICS");
  const [interviewerName, setInterviewerName] = useState("");
  const [interviewerEmail, setInterviewerEmail] = useState("");
  const [autoScheduleStart, setAutoScheduleStart] = useState("09:00");
  const [autoScheduleEnd, setAutoScheduleEnd] = useState("17:00");

  const { data: interviewers, refetch: refetchInterviewers } =
    api.admin.getInterviewers.useQuery();
  const { data: interviewSchedule, refetch: refetchSchedule } =
    api.admin.getInterviewSchedule.useQuery();
  const { data: teamDebugData } = api.admin.debugTeamSchedules.useQuery();

  const createInterviewer = api.admin.createInterviewer.useMutation({
    onSuccess() {
      toast.success("Interviewer created successfully!");
      setInterviewerName("");
      setInterviewerEmail("");
      void refetchInterviewers();
    },
    onError(error) {
      toast.error(`Error creating interviewer: ${error.message}`);
    },
  });

  const scheduleInterview = api.admin.scheduleInterview.useMutation({
    onSuccess() {
      toast.success("Interview scheduled successfully!");
      void refetchSchedule();
      void refetchAll();
    },
    onError(error) {
      toast.error(`Error scheduling interview: ${error.message}`);
    },
  });

  const clearInterview = api.admin.clearInterview.useMutation({
    onSuccess() {
      toast.success("Interview cleared successfully!");
      void refetchSchedule();
      void refetchAll();
    },
    onError(error) {
      toast.error(`Error clearing interview: ${error.message}`);
    },
  });

  const autoScheduleInterviews = api.admin.autoScheduleInterviews.useMutation({
    onSuccess(data) {
      toast.success(data.message);
      void refetchSchedule();
      void refetchAll();
    },
    onError(error) {
      toast.error(`Error auto-scheduling interviews: ${error.message}`);
    },
  });

  const clearAllInterviews = api.admin.clearAllInterviews.useMutation({
    onSuccess(data) {
      toast.success(data.message);
      void refetchSchedule();
      void refetchAll();
    },
    onError(error) {
      toast.error(`Error clearing interviews: ${error.message}`);
    },
  });

  const handleCreateInterviewer = () => {
    if (!interviewerName.trim() || !interviewerEmail.trim()) {
      toast.error("Please fill in all fields");
      return;
    }
    createInterviewer.mutate({
      name: interviewerName.trim(),
      email: interviewerEmail.trim(),
      area: selectedArea,
    });
  };

  const handleScheduleInterview = (
    userId: string,
    dateTimeString: string,
    interviewerId: string,
  ) => {
    const interviewTime = new Date(dateTimeString);
    if (isNaN(interviewTime.getTime())) {
      toast.error("Invalid date/time");
      return;
    }
    scheduleInterview.mutate({
      userId,
      interviewTime,
      interviewerId,
    });
  };

  const handleAutoSchedule = () => {
    const today = new Date();
    const startTime = new Date(today);
    const [startHour, startMinute] = autoScheduleStart.split(":").map(Number);
    startTime.setHours(startHour ?? 9, startMinute ?? 0, 0, 0);

    const endTime = new Date(today);
    const [endHour, endMinute] = autoScheduleEnd.split(":").map(Number);
    endTime.setHours(endHour ?? 17, endMinute ?? 0, 0, 0);

    console.log("Starting auto-schedule with:");
    console.log(
      `  Start time: ${startTime.toLocaleString()} (${startTime.toISOString()})`,
    );
    console.log(
      `  End time: ${endTime.toLocaleString()} (${endTime.toISOString()})`,
    );

    autoScheduleInterviews.mutate({
      startTime,
      endTime,
    });
  };

  const getAreaColor = (area: string) => {
    switch (area) {
      case "MECHANICS":
        return "bg-red-900 text-red-200";
      case "ELECTRONICS":
        return "bg-green-900 text-green-200";
      case "PROGRAMMING":
        return "bg-blue-900 text-blue-200";
      default:
        return "bg-gray-900 text-gray-200";
    }
  };

  const formatDateTime = (date: Date) => {
    return date.toLocaleString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Helper function to check for conflicts
  const checkConflicts = () => {
    if (!interviewSchedule) return [];

    const conflicts = [];

    for (const user of interviewSchedule) {
      if (!user.interviewTime || !user.team) continue;

      const interviewStart = new Date(user.interviewTime);
      const interviewEnd = new Date(interviewStart.getTime() + 15 * 60 * 1000);

      for (const round of user.team.rounds) {
        for (const challenge of round.challenges) {
          const challengeStart = new Date(challenge.time);
          const challengeEnd = new Date(
            challengeStart.getTime() + 5 * 60 * 1000,
          );

          // Check for overlap
          const hasOverlap = !(
            interviewEnd <= challengeStart || interviewStart >= challengeEnd
          );

          if (hasOverlap) {
            conflicts.push({
              user: {
                id: user.id,
                name: user.name ?? user.email,
                team: user.team.name,
                area: user.interviewArea,
                interviewer: user.interviewer?.name,
              },
              interview: {
                start: interviewStart,
                end: interviewEnd,
              },
              challenge: {
                name: challenge.name,
                round: round.number,
                start: challengeStart,
                end: challengeEnd,
              },
              overlap: {
                start: new Date(
                  Math.max(interviewStart.getTime(), challengeStart.getTime()),
                ),
                end: new Date(
                  Math.min(interviewEnd.getTime(), challengeEnd.getTime()),
                ),
              },
            });
          }
        }
      }
    }

    return conflicts;
  };

  const conflicts = checkConflicts();

  return (
    <div className="space-y-6">
      {/* Create Interviewer */}
      <div className="rounded-lg bg-gray-800 p-6">
        <h3 className="mb-4 text-xl font-semibold">Create Interviewer</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <input
            type="text"
            placeholder="Interviewer name"
            value={interviewerName}
            onChange={(e) => setInterviewerName(e.target.value)}
            className="rounded border border-gray-600 bg-gray-700 p-2"
          />
          <input
            type="email"
            placeholder="Interviewer email"
            value={interviewerEmail}
            onChange={(e) => setInterviewerEmail(e.target.value)}
            className="rounded border border-gray-600 bg-gray-700 p-2"
          />
          <select
            value={selectedArea}
            onChange={(e) =>
              setSelectedArea(e.target.value as typeof selectedArea)
            }
            className="rounded border border-gray-600 bg-gray-700 p-2"
          >
            <option value="MECHANICS">Mechanics</option>
            <option value="ELECTRONICS">Electronics</option>
            <option value="PROGRAMMING">Programming</option>
          </select>
          <button
            onClick={handleCreateInterviewer}
            disabled={createInterviewer.isPending}
            className="rounded bg-blue-600 px-4 py-2 hover:bg-blue-700 disabled:opacity-50"
          >
            {createInterviewer.isPending ? "Creating..." : "Create"}
          </button>
        </div>
      </div>

      <div className="rounded-lg bg-gray-800 p-6">
        <h3 className="mb-4 text-xl font-semibold">
          Interviewers ({interviewers?.length ?? 0})
        </h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {["MECHANICS", "ELECTRONICS", "PROGRAMMING"].map((area) => (
            <div key={area} className={`rounded-lg p-4 ${getAreaColor(area)}`}>
              <h4 className="mb-2 font-semibold">{area}</h4>
              <div className="space-y-2">
                {interviewers
                  ?.filter((i) => i.area === area)
                  .map((interviewer) => (
                    <div
                      key={interviewer.id}
                      className="rounded bg-black bg-opacity-20 p-2"
                    >
                      <p className="font-medium">{interviewer.name}</p>
                      <p className="text-xs opacity-75">{interviewer.email}</p>
                    </div>
                  ))}
                {interviewers?.filter((i) => i.area === area).length === 0 && (
                  <p className="text-sm opacity-75">No interviewers assigned</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-lg bg-gray-800 p-6">
        <h3 className="mb-4 text-xl font-semibold">Auto Schedule Interviews</h3>
        <div className="flex flex-wrap gap-4">
          <div>
            <label className="block text-sm text-gray-400">Start Time</label>
            <input
              type="time"
              value={autoScheduleStart}
              onChange={(e) => setAutoScheduleStart(e.target.value)}
              className="rounded border border-gray-600 bg-gray-700 p-2"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400">End Time</label>
            <input
              type="time"
              value={autoScheduleEnd}
              onChange={(e) => setAutoScheduleEnd(e.target.value)}
              className="rounded border border-gray-600 bg-gray-700 p-2"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={handleAutoSchedule}
              disabled={autoScheduleInterviews.isPending}
              className="rounded bg-green-600 px-6 py-2 hover:bg-green-700 disabled:opacity-50"
            >
              {autoScheduleInterviews.isPending
                ? "Scheduling..."
                : "Auto Schedule All"}
            </button>
          </div>
          <div className="flex items-end">
            <button
              onClick={() => {
                if (
                  confirm(
                    "Are you sure you want to clear all interviews? This cannot be undone.",
                  )
                ) {
                  clearAllInterviews.mutate();
                }
              }}
              disabled={clearAllInterviews.isPending}
              className="rounded bg-red-600 px-6 py-2 hover:bg-red-700 disabled:opacity-50"
            >
              {clearAllInterviews.isPending
                ? "Clearing..."
                : "Clear All Interviews"}
            </button>
          </div>
        </div>
        <p className="mt-2 text-sm text-gray-400">
          Optimized parallel scheduling: Up to 9 simultaneous interviews (3 per
          area) while avoiding team schedule conflicts
        </p>
      </div>

      <div className="rounded-lg bg-gray-800 p-6">
        <h3 className="mb-4 text-xl font-semibold">
          Interview Schedule (
          {interviewSchedule?.filter((u) => u.interviewTime).length ?? 0}{" "}
          scheduled)
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse border border-gray-600">
            <thead>
              <tr className="bg-gray-700">
                <th className="border border-gray-600 p-3 text-left">
                  Student
                </th>
                <th className="border border-gray-600 p-3 text-left">Team</th>
                <th className="border border-gray-600 p-3 text-left">
                  Interview Time
                </th>
                <th className="border border-gray-600 p-3 text-left">Area</th>
                <th className="border border-gray-600 p-3 text-left">
                  Interviewer
                </th>
                <th className="border border-gray-600 p-3 text-left">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {interviewSchedule?.map((user) => (
                <tr key={user.id} className="hover:bg-gray-700">
                  <td className="border border-gray-600 p-3">
                    <div>
                      <p className="font-medium">{user.name ?? user.email}</p>
                      {user.name && (
                        <p className="text-xs text-gray-400">{user.email}</p>
                      )}
                    </div>
                  </td>
                  <td className="border border-gray-600 p-3">
                    {user.team?.name ?? "No team"}
                  </td>
                  <td className="border border-gray-600 p-3">
                    {user.interviewTime ? (
                      <span className="font-mono text-sm">
                        {formatDateTime(user.interviewTime)}
                      </span>
                    ) : (
                      <span className="text-gray-400">Not scheduled</span>
                    )}
                  </td>
                  <td className="border border-gray-600 p-3">
                    {user.interviewArea ? (
                      <span
                        className={`rounded px-2 py-1 text-xs ${getAreaColor(user.interviewArea)}`}
                      >
                        {user.interviewArea}
                      </span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="border border-gray-600 p-3">
                    {user.interviewer?.name ?? "None"}
                  </td>
                  <td className="border border-gray-600 p-3">
                    <div className="flex gap-2">
                      {user.interviewTime && (
                        <button
                          onClick={() =>
                            clearInterview.mutate({ userId: user.id })
                          }
                          disabled={clearInterview.isPending}
                          className="rounded bg-red-600 px-2 py-1 text-xs hover:bg-red-700 disabled:opacity-50"
                        >
                          Clear
                        </button>
                      )}
                      <button
                        onClick={() => {
                          const datetime = prompt(
                            "Enter interview date/time (YYYY-MM-DD HH:MM):",
                          );
                          if (!datetime) return;

                          const userArea = user.interviewArea;
                          if (!userArea) {
                            toast.error(
                              "User has no area preference set. Please assign an area first.",
                            );
                            return;
                          }

                          // Find available interviewers for the user's area
                          const availableInterviewers =
                            interviewers?.filter((i) => i.area === userArea) ??
                            [];

                          if (availableInterviewers.length === 0) {
                            toast.error(
                              `No interviewers available for ${userArea} area`,
                            );
                            return;
                          }

                          // Use the first available interviewer (could be enhanced with conflict checking)
                          const interviewerId = availableInterviewers[0]?.id;
                          if (datetime && interviewerId) {
                            handleScheduleInterview(
                              user.id,
                              datetime,
                              interviewerId,
                            );
                          }
                        }}
                        disabled={scheduleInterview.isPending}
                        className="rounded bg-blue-600 px-2 py-1 text-xs hover:bg-blue-700 disabled:opacity-50"
                      >
                        {user.interviewTime ? "Reschedule" : "Schedule"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
        <div className="rounded-lg bg-gray-800 p-4">
          <h4 className="font-semibold">Total Students</h4>
          <p className="text-2xl font-bold">{interviewSchedule?.length ?? 0}</p>
        </div>
        <div className="rounded-lg bg-gray-800 p-4">
          <h4 className="font-semibold">Scheduled Interviews</h4>
          <p className="text-2xl font-bold text-green-400">
            {interviewSchedule?.filter((u) => u.interviewTime).length ?? 0}
          </p>
        </div>
        <div className="rounded-lg bg-gray-800 p-4">
          <h4 className="font-semibold">Pending Interviews</h4>
          <p className="text-2xl font-bold text-orange-400">
            {interviewSchedule?.filter((u) => !u.interviewTime).length ?? 0}
          </p>
        </div>
        <div className="rounded-lg bg-gray-800 p-4">
          <h4 className="font-semibold">Total Interviewers</h4>
          <p className="text-2xl font-bold">{interviewers?.length ?? 0}</p>
        </div>
        <div className="rounded-lg bg-gray-800 p-4">
          <h4 className="font-semibold">Max Parallel Capacity</h4>
          <p className="text-2xl font-bold text-blue-400">
            {Math.min(
              ...["MECHANICS", "ELECTRONICS", "PROGRAMMING"].map(
                (area) =>
                  interviewers?.filter((i) => i.area === area).length ?? 0,
              ),
            ) * 3}
            /slot
          </p>
        </div>
      </div>

      <div className="rounded-lg bg-gray-800 p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-xl font-semibold">Schedule Conflict Detection</h3>
          <div className="flex items-center gap-4">
            <span
              className={`rounded px-3 py-1 text-sm font-medium ${
                conflicts.length === 0
                  ? "bg-green-900 text-green-200"
                  : "bg-red-900 text-red-200"
              }`}
            >
              {conflicts.length === 0
                ? "✅ No Conflicts"
                : `⚠️ ${conflicts.length} Conflicts`}
            </span>
          </div>
        </div>

        {conflicts.length > 0 && (
          <div className="space-y-4">
            <div className="rounded border border-red-500/30 bg-red-900/20 p-4">
              <h4 className="mb-3 font-semibold text-red-400">
                ❌ Detected Conflicts:
              </h4>
              <div className="space-y-3">
                {conflicts.map((conflict, index) => (
                  <div key={index} className="rounded bg-gray-700 p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-white">
                          {conflict.user.name}
                        </span>
                        <span className="text-sm text-gray-400">
                          Team {conflict.user.team}
                        </span>
                        <span
                          className={`rounded px-2 py-1 text-xs ${getAreaColor(conflict.user.area ?? "")}`}
                        >
                          {conflict.user.area}
                        </span>
                      </div>
                      <span className="text-xs text-gray-400">
                        Interviewer: {conflict.user.interviewer ?? "None"}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                      {/* Interview Timeline */}
                      <div className="rounded bg-blue-900/30 p-3">
                        <h5 className="mb-1 text-sm font-medium text-blue-400">
                          Interview
                        </h5>
                        <p className="text-xs text-gray-300">
                          {conflict.interview.start.toLocaleTimeString()} -{" "}
                          {conflict.interview.end.toLocaleTimeString()}
                        </p>
                        <div className="mt-2 h-2 rounded bg-blue-600"></div>
                      </div>

                      {/* Challenge Timeline */}
                      <div className="rounded bg-orange-900/30 p-3">
                        <h5 className="mb-1 text-sm font-medium text-orange-400">
                          Challenge
                        </h5>
                        <p className="text-xs text-gray-300">
                          Round {conflict.challenge.round}:{" "}
                          {conflict.challenge.name}
                        </p>
                        <p className="text-xs text-gray-300">
                          {conflict.challenge.start.toLocaleTimeString()} -{" "}
                          {conflict.challenge.end.toLocaleTimeString()}
                        </p>
                        <div className="mt-2 h-2 rounded bg-orange-600"></div>
                      </div>

                      {/* Overlap */}
                      <div className="rounded bg-red-900/30 p-3">
                        <h5 className="mb-1 text-sm font-medium text-red-400">
                          Overlap
                        </h5>
                        <p className="text-xs text-gray-300">
                          {conflict.overlap.start.toLocaleTimeString()} -{" "}
                          {conflict.overlap.end.toLocaleTimeString()}
                        </p>
                        <p className="text-xs text-red-300">
                          Duration:{" "}
                          {Math.round(
                            (conflict.overlap.end.getTime() -
                              conflict.overlap.start.getTime()) /
                              60000,
                          )}{" "}
                          min
                        </p>
                        <div className="mt-2 h-2 animate-pulse rounded bg-red-600"></div>
                      </div>
                    </div>

                    {/* Visual Timeline */}
                    <div className="mt-3">
                      <h6 className="mb-2 text-xs font-medium text-gray-400">
                        Timeline Visualization:
                      </h6>
                      <div className="relative h-8 rounded bg-gray-600">
                        {/* Calculate positions (simplified for demo) */}
                        <div
                          className="absolute h-full rounded bg-blue-500/70"
                          style={{
                            left: "20%",
                            width: "30%",
                          }}
                          title={`Interview: ${conflict.interview.start.toLocaleTimeString()} - ${conflict.interview.end.toLocaleTimeString()}`}
                        ></div>
                        <div
                          className="absolute h-full rounded bg-orange-500/70"
                          style={{
                            left: "35%",
                            width: "20%",
                          }}
                          title={`Challenge: ${conflict.challenge.start.toLocaleTimeString()} - ${conflict.challenge.end.toLocaleTimeString()}`}
                        ></div>
                        <div
                          className="absolute h-full animate-pulse rounded bg-red-600"
                          style={{
                            left: "35%",
                            width: "15%",
                          }}
                          title="Conflict zone"
                        ></div>
                      </div>
                      <div className="mt-1 flex justify-between text-xs text-gray-400">
                        <span>12:00</span>
                        <span>12:30</span>
                        <span>13:00</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {conflicts.length === 0 &&
          (interviewSchedule?.filter((u) => u.interviewTime) ?? []).length >
            0 && (
            <div className="rounded border border-green-500/30 bg-green-900/20 p-4 text-center">
              <div className="text-green-400">
                <h4 className="mt-2 font-semibold">
                  All Interviews Scheduled Successfully!
                </h4>
                <p className="mt-1 text-sm text-green-300">
                  No conflicts detected between interviews and team schedules.
                </p>
              </div>
            </div>
          )}

        {(interviewSchedule?.filter((u) => u.interviewTime) ?? []).length ===
          0 && (
          <div className="rounded bg-gray-700 p-4 text-center">
            <span className="text-gray-400">
              No interviews scheduled yet. Use &quot;Auto Schedule All&quot; to
              begin.
            </span>
          </div>
        )}
      </div>

      <div className="rounded-lg bg-gray-800 p-6">
        <h3 className="mb-4 text-xl font-semibold">
          Debug: Team Schedule Data
        </h3>
        <div className="max-h-96 overflow-y-auto">
          {teamDebugData?.map((team) => (
            <div key={team.name} className="mb-4 rounded bg-gray-700 p-3">
              <h4 className="font-semibold text-blue-400">Team {team.name}</h4>
              <p className="text-sm text-gray-300">
                Members: {team.members.length}
              </p>
              {team.rounds.map((round) => (
                <div key={round.number} className="mt-2">
                  <p className="text-sm font-medium text-yellow-400">
                    Round {round.number}:
                  </p>
                  {round.challenges.map((challenge, idx) => (
                    <p key={idx} className="ml-4 text-xs text-gray-300">
                      {challenge.name}:{" "}
                      {new Date(challenge.timeString).toLocaleTimeString()}
                    </p>
                  ))}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
