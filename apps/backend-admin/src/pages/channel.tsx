import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useEffect, useState } from "react";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Chip } from "@heroui/chip";

import DefaultLayout from "@/layouts/default";
import { title } from "@/components/primitives";
import { useSecuredApi, useAuth } from "@/authentication";
import { APIResponse, PTTChannel, ChannelParticipantsResponse, ChannelParticipant } from "@/types/ptt";

export default function ChannelPage() {
    const { t } = useTranslation();
    const { uuid } = useParams<{ uuid: string }>();
    const { getJson } = useSecuredApi();
    const { hasPermission } = useAuth();
    const [channel, setChannel] = useState<PTTChannel | null>(null);
    const [participants, setParticipants] = useState<ChannelParticipant[]>([]);
    const [loading, setLoading] = useState(true);
    const [participantsLoading, setParticipantsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [canViewParticipants, setCanViewParticipants] = useState<boolean>(false);

    useEffect(() => {
        const fetchChannel = async () => {
            if (!uuid) return;

            try {
                setLoading(true);
                const response = await getJson(
                    `${import.meta.env.API_BASE_URL}/v1/channels/${uuid}`,
                ) as APIResponse<PTTChannel>;

                if (response.data) {
                    setChannel(response.data);

                    // Check permissions for viewing participants
                    const isAdmin = await hasPermission(import.meta.env.ADMIN_PERMISSION);
                    const hasAccessToChannel = await hasPermission(`${import.meta.env.ACCESS_PERMISSION_PREFIX}:${uuid.toLowerCase()}`);

                    if (isAdmin || hasAccessToChannel) {
                        setCanViewParticipants(true);
                        // Fetch participants after channel is loaded and permissions verified
                        await fetchParticipants();
                    } else {
                        setCanViewParticipants(false);
                    }
                } else {
                    setError(t("channel_not_found"));
                }
            } catch (err) {
                console.error("Error fetching channel:", err);
                setError(t("error_loading_channel"));
            } finally {
                setLoading(false);
            }
        };

        const fetchParticipants = async () => {
            if (!uuid) return;

            try {
                setParticipantsLoading(true);
                const response = await getJson(
                    `${import.meta.env.API_BASE_URL}/v1/channels/${uuid}/participants`,
                ) as APIResponse<ChannelParticipantsResponse>;

                if (response.data) {
                    setParticipants(response.data.participants || []);
                } else {
                    setParticipants([]);
                }
            } catch (err) {
                console.error("Error fetching participants:", err);
                setParticipants([]); // Ensure participants is always an array
                // Don't set error for participants, just log it
            } finally {
                setParticipantsLoading(false);
            }
        };

        fetchChannel();
    }, [uuid, getJson, t]);

    const getConnectionQualityColor = (quality: string) => {
        switch (quality) {
            case "excellent": return "success";
            case "good": return "primary";
            case "fair": return "warning";
            case "poor": return "danger";
            default: return "default";
        }
    };

    if (loading) {
        return (
            <DefaultLayout>
                <section className="flex flex-col items-center justify-center gap-4 py-8 md:py-10">
                    <div className="inline-block max-w-lg text-center justify-center">
                        <h1 className={title()}>{t("loading")}...</h1>
                    </div>
                </section>
            </DefaultLayout>
        );
    }

    if (error || !channel) {
        return (
            <DefaultLayout>
                <section className="flex flex-col items-center justify-center gap-4 py-8 md:py-10">
                    <div className="inline-block max-w-lg text-center justify-center">
                        <h1 className={title({ color: "pink" })}>{error || t("channel_not_found")}</h1>
                    </div>
                </section>
            </DefaultLayout>
        );
    }

    return (
        <DefaultLayout>
            <section className="flex flex-col items-center justify-center gap-4 py-8 md:py-10">
                <div className="inline-block max-w-lg text-center justify-center">
                    <h1 className={title()}>{channel.name}</h1>
                    <h2 className="text-lg text-default-600 mt-2">{channel.description}</h2>
                </div>

                <Card className="max-w-2xl w-full">
                    <CardHeader className="flex gap-3">
                        <div className="flex flex-col">
                            <p className="text-md font-semibold">{t("channel_details")}</p>
                            <p className="text-small text-default-500">{channel.uuid}</p>
                        </div>
                    </CardHeader>
                    <CardBody>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <p className="font-semibold">{t("type")}:</p>
                                <Chip
                                    color={
                                        channel.type === "emergency" ? "danger" :
                                            channel.type === "site_local" ? "primary" :
                                                channel.type === "instructors" ? "warning" : "default"
                                    }
                                    variant="flat"
                                >
                                    {channel.type}
                                </Chip>
                            </div>

                            <div>
                                <p className="font-semibold">{t("status")}:</p>
                                <Chip
                                    color={channel.is_active ? "success" : "danger"}
                                    variant="flat"
                                >
                                    {channel.is_active ? t("active") : t("inactive")}
                                </Chip>
                            </div>

                            <div>
                                <p className="font-semibold">{t("max_participants")}:</p>
                                <p>{channel.max_participants}</p>
                            </div>

                            {channel.vhf_frequency && (
                                <div>
                                    <p className="font-semibold">{t("vhf_frequency")}:</p>
                                    <p>{channel.vhf_frequency} MHz</p>
                                </div>
                            )}

                            {channel.coordinates && (
                                <div>
                                    <p className="font-semibold">{t("coordinates")}:</p>
                                    <p>{channel.coordinates.lat.toFixed(6)}, {channel.coordinates.lon.toFixed(6)}</p>
                                </div>
                            )}

                            {channel.radius_km && (
                                <div>
                                    <p className="font-semibold">{t("radius")}:</p>
                                    <p>{channel.radius_km} km</p>
                                </div>
                            )}

                            {channel.difficulty && (
                                <div>
                                    <p className="font-semibold">{t("difficulty")}:</p>
                                    <Chip
                                        color={
                                            channel.difficulty === "expert" ? "danger" :
                                                channel.difficulty === "advanced" ? "warning" :
                                                    channel.difficulty === "intermediate" ? "primary" : "success"
                                        }
                                        variant="flat"
                                    >
                                        {channel.difficulty}
                                    </Chip>
                                </div>
                            )}

                            <div>
                                <p className="font-semibold">{t("created_at")}:</p>
                                <p>{new Date(channel.created_at).toLocaleDateString()}</p>
                            </div>
                        </div>
                    </CardBody>
                </Card>

                {/* Participants Section - Only show if user has permissions */}
                {canViewParticipants && (
                    <Card className="max-w-2xl w-full">
                        <CardHeader className="flex gap-3">
                            <div className="flex flex-col">
                                <p className="text-md font-semibold">{t("participants")}</p>
                                <p className="text-small text-default-500">
                                    {participantsLoading ? t("loading") : `${participants?.length ?? 0} ${t("participants").toLowerCase()}`}
                                </p>
                            </div>
                        </CardHeader>
                        <CardBody>
                            {participantsLoading ? (
                                <div className="text-center py-4">
                                    <p>{t("loading")}...</p>
                                </div>
                            ) : !participants || participants.length === 0 ? (
                                <div className="text-center py-4">
                                    <p className="text-default-500">{t("no_participants")}</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {participants.map((participant, index) => (
                                        <div key={participant.user_id || index} className="border-b border-default-200 last:border-b-0 pb-4 last:pb-0">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div>
                                                    <p className="font-semibold">{t("username")}:</p>
                                                    <p>{participant.username}</p>
                                                </div>

                                                <div>
                                                    <p className="font-semibold">{t("connection_quality")}:</p>
                                                    <Chip
                                                        color={getConnectionQualityColor(participant.connection_quality)}
                                                        variant="flat"
                                                    >
                                                        {t(participant.connection_quality)}
                                                    </Chip>
                                                </div>

                                                <div>
                                                    <p className="font-semibold">{t("is_transmitting")}:</p>
                                                    <Chip
                                                        color={participant.is_transmitting ? "success" : "default"}
                                                        variant="flat"
                                                    >
                                                        {participant.is_transmitting ? t("yes") : t("no")}
                                                    </Chip>
                                                </div>

                                                <div>
                                                    <p className="font-semibold">{t("join_time")}:</p>
                                                    <p>{new Date(participant.join_time).toLocaleString()}</p>
                                                </div>

                                                <div>
                                                    <p className="font-semibold">{t("last_seen")}:</p>
                                                    <p>{new Date(participant.last_seen).toLocaleString()}</p>
                                                </div>

                                                {participant.location && (
                                                    <div>
                                                        <p className="font-semibold">{t("coordinates")}:</p>
                                                        <p>{participant.location.lat.toFixed(6)}, {participant.location.lon.toFixed(6)}</p>
                                                    </div>
                                                )}

                                                {participant.os_type && (
                                                    <div>
                                                        <p className="font-semibold">OS:</p>
                                                        <p>{participant.os_type} {participant.os_version}</p>
                                                    </div>
                                                )}

                                                {participant.app_version && (
                                                    <div>
                                                        <p className="font-semibold">App Version:</p>
                                                        <p>{participant.app_version}</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardBody>
                    </Card>
                )}
            </section>
        </DefaultLayout>
    );
}
