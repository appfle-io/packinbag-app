"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthProvider";
import AnnouncementAdminScreen from "@/components/screens/AnnouncementAdminScreen";
import { Announcement } from "@/lib/types";
import {
  subscribeToAnnouncements,
  createAnnouncementRemote,
  updateAnnouncementRemote,
  deleteAnnouncementRemote,
} from "@/lib/announcementsService";

export default function AdminAnnouncementsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);

  useEffect(() => subscribeToAnnouncements(setAnnouncements), []);

  return (
    <div className="flex flex-col h-screen max-w-2xl mx-auto">
      <AnnouncementAdminScreen
        announcements={announcements}
        uid={user?.uid ?? ""}
        onBack={() => router.push("/admin")}
        onCreate={async (data) => {
          await createAnnouncementRemote(data);
        }}
        onUpdate={async (id, data) => {
          await updateAnnouncementRemote(id, data);
        }}
        onDelete={async (id) => {
          await deleteAnnouncementRemote(id);
        }}
      />
    </div>
  );
}
