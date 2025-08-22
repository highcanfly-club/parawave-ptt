import { useTranslation } from "react-i18next";
import { Button } from "@heroui/button";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Divider } from "@heroui/divider";
import {
    Table,
    TableHeader,
    TableBody,
    TableColumn,
    TableRow,
    TableCell
} from "@heroui/table";
import { Chip } from "@heroui/chip";
import {
    Modal,
    ModalContent,
    ModalHeader,
    ModalBody,
    ModalFooter,
    useDisclosure
} from "@heroui/modal";
import { Input } from "@heroui/input";
import {
    Dropdown,
    DropdownTrigger,
    DropdownMenu,
    DropdownItem,
} from "@heroui/dropdown";
import { useEffect, useState } from "react";

import DefaultLayout from "@/layouts/default";
import { title } from "@/components/primitives";
import { useAuth, useSecuredApi } from "@/authentication";
import { APIResponse, ChannelsListResponse, ChannelType, CreateChannelRequest, PTTChannel } from "@/types/ptt";

export default function ChannelsAdminPage() {
    const { t } = useTranslation();
    const { getJson, postJson, putJson, deleteJson } = useSecuredApi();
    const { isAuthenticated, user, hasPermission } = useAuth();
    const [channels, setChannels] = useState<ChannelsListResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isAdminUser, setIsAdminUser] = useState(false);

    // Modal states
    const { isOpen: isCreateOpen, onOpen: onCreateOpen, onClose: onCreateClose } = useDisclosure();
    const { isOpen: isUpdateOpen, onOpen: onUpdateOpen, onClose: onUpdateClose } = useDisclosure();
    const { isOpen: isDeleteOpen, onOpen: onDeleteOpen, onClose: onDeleteClose } = useDisclosure();

    // Form states
    const [selectedChannel, setSelectedChannel] = useState<(PTTChannel & any) | null>(null);
    const [formData, setFormData] = useState<CreateChannelRequest>({
        name: '',
        type: 'general' as ChannelType,
        description: '',
        max_participants: 10,
        vhf_frequency: '',
    });
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const adminPermission = await hasPermission(import.meta.env.ADMIN_PERMISSION);
                setIsAdminUser(adminPermission);

                if (!adminPermission) {
                    setError("Insufficient permissions");
                    setLoading(false);
                    return;
                }

                if (isAuthenticated && user) {
                    const response = await getJson(
                        `${import.meta.env.API_BASE_URL}/v1/channels`,
                    ) as APIResponse<ChannelsListResponse>;

                    if (response.data) {
                        setChannels(response.data);
                    } else {
                        setError("Failed to load channels");
                    }
                }
            } catch (err) {
                console.error("API Error:", err);
                setError("Error loading channels");
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [isAuthenticated, user, hasPermission, getJson]);

    const refreshChannels = async () => {
        try {
            setLoading(true);
            const response = await getJson(
                `${import.meta.env.API_BASE_URL}/v1/channels`,
            ) as APIResponse<ChannelsListResponse>;

            if (response.data) {
                setChannels(response.data);
            }
        } catch (err) {
            console.error("API Error:", err);
            setError("Error loading channels");
        } finally {
            setLoading(false);
        }
    };

    const resetForm = () => {
        setFormData({
            name: '',
            type: 'general' as ChannelType,
            description: '',
            max_participants: 10,
            vhf_frequency: '',
        });
        setSelectedChannel(null);
    };

    const handleCreateChannel = () => {
        resetForm();
        onCreateOpen();
    };

    const handleUpdateChannel = (channel: PTTChannel & any) => {
        setSelectedChannel(channel);
        setFormData({
            name: channel.name,
            type: channel.type,
            description: channel.description || '',
            max_participants: channel.max_participants,
            vhf_frequency: channel.vhf_frequency || '',
        });
        onUpdateOpen();
    };

    const handleDeleteChannel = (channel: PTTChannel & any) => {
        setSelectedChannel(channel);
        onDeleteOpen();
    };

    const submitCreateChannel = async () => {
        try {
            setSubmitting(true);
            const response = await postJson(
                `${import.meta.env.API_BASE_URL}/v1/channels`,
                formData
            );

            if (response.success) {
                await refreshChannels();
                onCreateClose();
                resetForm();
            } else {
                setError(response.error || "Failed to create channel");
            }
        } catch (err) {
            console.error("Create channel error:", err);
            setError("Error creating channel");
        } finally {
            setSubmitting(false);
        }
    };

    const submitUpdateChannel = async () => {
        if (!selectedChannel) return;

        try {
            setSubmitting(true);
            // Utilisation de putJson pour appeler l'API PUT /api/v1/channels/{uuid}
            const response = await putJson(
                `${import.meta.env.API_BASE_URL}/v1/channels/${selectedChannel.uuid}`,
                formData
            );

            if (response.success) {
                await refreshChannels();
                onUpdateClose();
                resetForm();
            } else {
                setError(response.error || "Failed to update channel");
            }
        } catch (err) {
            console.error("Update channel error:", err);
            setError("Error updating channel");
        } finally {
            setSubmitting(false);
        }
    };

    const submitDeleteChannel = async () => {
        if (!selectedChannel) return;

        try {
            setSubmitting(true);
            const response = await deleteJson(
                `${import.meta.env.API_BASE_URL}/v1/channels/${selectedChannel.uuid}`
            );

            if (response.success) {
                await refreshChannels();
                onDeleteClose();
                resetForm();
            } else {
                setError(response.error || "Failed to delete channel");
            }
        } catch (err) {
            console.error("Delete channel error:", err);
            setError("Error deleting channel");
        } finally {
            setSubmitting(false);
        }
    };

    const getStatusChip = (isActive: boolean) => {
        const color = isActive ? "success" : "default";
        const status = isActive ? "active" : "inactive";
        return (
            <Chip color={color} size="sm" variant="flat">
                {t(status)}
            </Chip>
        );
    };

    const getTypeChip = (type: ChannelType) => {
        const colorMap: Record<ChannelType, "default" | "danger" | "warning" | "primary" | "secondary"> = {
            site_local: "default",
            emergency: "danger",
            general: "primary",
            cross_country: "warning",
            instructors: "secondary",
        };

        return (
            <Chip
                color={colorMap[type]}
                size="sm"
                variant="flat"
            >
                {type.replace('_', ' ')}
            </Chip>
        );
    };

    if (!isAuthenticated) {
        return (
            <DefaultLayout>
                <div className="text-center">
                    <h1 className={title()}>Not Authenticated</h1>
                    <p>Please log in to access this page.</p>
                </div>
            </DefaultLayout>
        );
    }

    if (!isAdminUser) {
        return (
            <DefaultLayout>
                <div className="text-center">
                    <h1 className={title()}>Access Denied</h1>
                    <p>You do not have permission to access this page.</p>
                </div>
            </DefaultLayout>
        );
    }

    return (
        <DefaultLayout>
            <section className="flex flex-col items-center justify-center gap-4 py-8 md:py-10">
                <div className="inline-block max-w-xl text-center justify-center">
                    <span className={title()}>{t("channels_administration")}</span>
                </div>
            </section>

            <section className="flex flex-col gap-4 py-4">
                <div className="flex justify-end">
                    <Button
                        color="primary"
                        variant="solid"
                        onPress={handleCreateChannel}
                    >
                        {t("create_channel")}
                    </Button>
                </div>

                {loading && (
                    <div className="flex justify-center">
                        <p>{t("loading")}</p>
                    </div>
                )}

                {error && (
                    <Card>
                        <CardBody>
                            <p className="text-danger">{t("error")}: {error}</p>
                        </CardBody>
                    </Card>
                )}

                {channels && channels.total_count > 0 && (
                    <Card>
                        <CardHeader className="flex gap-3">
                            <div className="flex flex-col">
                                <p className="text-md font-medium">{t("channels")}</p>
                                <p className="text-small text-default-500">
                                    {channels.total_count} {channels.total_count === 1 ? t("channel") : t("channels")}
                                </p>
                            </div>
                        </CardHeader>
                        <Divider />
                        <CardBody>
                            <Table aria-label="Channels table">
                                <TableHeader>
                                    <TableColumn>NAME</TableColumn>
                                    <TableColumn>TYPE</TableColumn>
                                    <TableColumn>STATUS</TableColumn>
                                    <TableColumn>MAX PARTICIPANTS</TableColumn>
                                    <TableColumn>FREQUENCY</TableColumn>
                                    <TableColumn>{t("actions").toUpperCase()}</TableColumn>
                                </TableHeader>
                                <TableBody>
                                    {channels.channels.map((channel) => (
                                        <TableRow key={channel.uuid}>
                                            <TableCell>{channel.name}</TableCell>
                                            <TableCell>{getTypeChip(channel.type)}</TableCell>
                                            <TableCell>{getStatusChip(channel.is_active)}</TableCell>
                                            <TableCell>{channel.max_participants || "N/A"}</TableCell>
                                            <TableCell>{channel.vhf_frequency || "N/A"}</TableCell>
                                            <TableCell>
                                                <div className="flex gap-2">
                                                    <Button
                                                        size="sm"
                                                        variant="light"
                                                        color="primary"
                                                        onPress={() => window.open(`/channel/${channel.uuid}`, '_blank')}
                                                    >
                                                        {t("view_channel")}
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="light"
                                                        color="secondary"
                                                        onPress={() => handleUpdateChannel(channel)}
                                                    >
                                                        {t("edit_channel")}
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="light"
                                                        color="danger"
                                                        onPress={() => handleDeleteChannel(channel)}
                                                    >
                                                        {t("delete_channel")}
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardBody>
                    </Card>
                )}

                {channels && channels.total_count === 0 && (
                    <Card>
                        <CardBody className="text-center py-8">
                            <p className="text-default-500">{t("no_channels_found")}</p>
                            <Button
                                color="primary"
                                variant="ghost"
                                className="mt-4"
                                onPress={handleCreateChannel}
                            >
                                {t("create_first_channel")}
                            </Button>
                        </CardBody>
                    </Card>
                )}
            </section>

            {/* Create Channel Modal */}
            <Modal isOpen={isCreateOpen} onClose={onCreateClose} size="2xl">
                <ModalContent>
                    <ModalHeader>
                        <h3>{t("create_channel")}</h3>
                    </ModalHeader>
                    <ModalBody>
                        <div className="flex flex-col gap-4">
                            <Input
                                label={t("channel_name")}
                                placeholder="Enter channel name"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                isRequired
                            />
                            <div className="flex flex-col gap-2">
                                <label className="text-small text-default-500">{t("channel_type")}</label>
                                <Dropdown>
                                    <DropdownTrigger>
                                        <Button variant="bordered" className="capitalize">
                                            {formData.type.replace('_', ' ')}
                                        </Button>
                                    </DropdownTrigger>
                                    <DropdownMenu
                                        aria-label="Channel type selection"
                                        selectionMode="single"
                                        selectedKeys={[formData.type]}
                                        onSelectionChange={(keys: any) => {
                                            const selected = Array.from(keys)[0] as ChannelType;
                                            setFormData({ ...formData, type: selected });
                                        }}
                                    >
                                        <DropdownItem key="general">General</DropdownItem>
                                        <DropdownItem key="site_local">Site Local</DropdownItem>
                                        <DropdownItem key="cross_country">Cross Country</DropdownItem>
                                        <DropdownItem key="instructors">Instructors</DropdownItem>
                                        <DropdownItem key="emergency">Emergency</DropdownItem>
                                    </DropdownMenu>
                                </Dropdown>
                            </div>
                            <div className="flex gap-4">
                                <Input
                                    label={t("max_participants")}
                                    type="number"
                                    placeholder="10"
                                    value={formData.max_participants?.toString() || ''}
                                    onChange={(e) => setFormData({ ...formData, max_participants: parseInt(e.target.value) || 10 })}
                                />
                                <Input
                                    label={t("vhf_frequency")}
                                    placeholder="123.456 MHz"
                                    value={formData.vhf_frequency}
                                    onChange={(e) => setFormData({ ...formData, vhf_frequency: e.target.value })}
                                />
                            </div>
                            <Input
                                label={t("description")}
                                placeholder="Channel description (optional)"
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            />
                        </div>
                    </ModalBody>
                    <ModalFooter>
                        <Button
                            color="danger"
                            variant="light"
                            onPress={onCreateClose}
                            isDisabled={submitting}
                        >
                            {t("cancel")}
                        </Button>
                        <Button
                            color="primary"
                            onPress={submitCreateChannel}
                            isLoading={submitting}
                        >
                            {t("create_channel")}
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>

            {/* Update Channel Modal */}
            <Modal isOpen={isUpdateOpen} onClose={onUpdateClose} size="2xl">
                <ModalContent>
                    <ModalHeader>
                        <h3>{t("update_channel")}</h3>
                    </ModalHeader>
                    <ModalBody>
                        <div className="flex flex-col gap-4">
                            <Input
                                label={t("channel_name")}
                                placeholder="Enter channel name"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                isRequired
                            />
                            <div className="flex flex-col gap-2">
                                <label className="text-small text-default-500">{t("channel_type")}</label>
                                <Dropdown>
                                    <DropdownTrigger>
                                        <Button variant="bordered" className="capitalize">
                                            {formData.type.replace('_', ' ')}
                                        </Button>
                                    </DropdownTrigger>
                                    <DropdownMenu
                                        aria-label="Channel type selection"
                                        selectionMode="single"
                                        selectedKeys={[formData.type]}
                                        onSelectionChange={(keys: any) => {
                                            const selected = Array.from(keys)[0] as ChannelType;
                                            setFormData({ ...formData, type: selected });
                                        }}
                                    >
                                        <DropdownItem key="general">General</DropdownItem>
                                        <DropdownItem key="site_local">Site Local</DropdownItem>
                                        <DropdownItem key="cross_country">Cross Country</DropdownItem>
                                        <DropdownItem key="instructors">Instructors</DropdownItem>
                                        <DropdownItem key="emergency">Emergency</DropdownItem>
                                    </DropdownMenu>
                                </Dropdown>
                            </div>
                            <div className="flex gap-4">
                                <Input
                                    label={t("max_participants")}
                                    type="number"
                                    placeholder="10"
                                    value={formData.max_participants?.toString() || ''}
                                    onChange={(e) => setFormData({ ...formData, max_participants: parseInt(e.target.value) || 10 })}
                                />
                                <Input
                                    label={t("vhf_frequency")}
                                    placeholder="123.456 MHz"
                                    value={formData.vhf_frequency}
                                    onChange={(e) => setFormData({ ...formData, vhf_frequency: e.target.value })}
                                />
                            </div>
                            <Input
                                label={t("description")}
                                placeholder="Channel description (optional)"
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            />
                        </div>
                    </ModalBody>
                    <ModalFooter>
                        <Button
                            color="danger"
                            variant="light"
                            onPress={onUpdateClose}
                            isDisabled={submitting}
                        >
                            {t("cancel")}
                        </Button>
                        <Button
                            color="primary"
                            onPress={submitUpdateChannel}
                            isLoading={submitting}
                        >
                            {t("update_channel")}
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>

            {/* Delete Channel Modal */}
            <Modal isOpen={isDeleteOpen} onClose={onDeleteClose}>
                <ModalContent>
                    <ModalHeader>
                        <h3>{t("delete_channel")}</h3>
                    </ModalHeader>
                    <ModalBody>
                        <p>
                            {t("delete_confirmation")} <strong>"{selectedChannel?.name}"</strong>?
                        </p>
                        <p className="text-danger text-sm mt-2">
                            {t("delete_warning")}
                        </p>
                    </ModalBody>
                    <ModalFooter>
                        <Button
                            color="default"
                            variant="light"
                            onPress={onDeleteClose}
                            isDisabled={submitting}
                        >
                            {t("cancel")}
                        </Button>
                        <Button
                            color="danger"
                            onPress={submitDeleteChannel}
                            isLoading={submitting}
                        >
                            {t("delete_channel")}
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>
        </DefaultLayout>
    );
}
