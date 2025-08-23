/**
 * @copyright Copyright (c) 2024-2025 Ronan LE MEILLAT
 * @license AGPL-3.0-or-later
 */

import { useState, useEffect } from "react";
import {
    Modal,
    ModalContent,
    ModalHeader,
    ModalBody,
    ModalFooter,
} from "@heroui/modal";
import { Button } from "@heroui/button";
import { Checkbox } from "@heroui/checkbox";
import { Spinner } from "@heroui/spinner";
import { Chip } from "@heroui/chip";
import { Divider } from "@heroui/divider";
import { useTranslation } from "react-i18next";
import { useSecuredApi } from "@/authentication";
import { APIResponse } from "@/types/ptt";

interface Auth0Permission {
    permission_name: string;
    description: string;
    resource_server_name: string;
    resource_server_identifier: string;
    sources: Array<{
        source_id: string;
        source_name: string;
        source_type: string;
    }>;
}

interface Auth0User {
    user_id: string;
    email: string;
    name?: string;
    nickname?: string;
    picture?: string;
    created_at: string;
    last_login?: string;
    logins_count: number;
    blocked?: boolean;
    email_verified?: boolean;
    permissions?: Auth0Permission[];
}

interface Channel {
    uuid: string;
    name: string;
    description?: string;
    type: string;
}

interface ChannelsListResponse {
    channels: Channel[];
    total: number;
}

interface EditPermissionsModalProps {
    isOpen: boolean;
    onClose: () => void;
    user: Auth0User;
    managementToken: string;
    onPermissionsUpdated: (user: Auth0User) => void;
}

export default function EditPermissionsModal({
    isOpen,
    onClose,
    user,
    managementToken,
    onPermissionsUpdated,
}: EditPermissionsModalProps) {
    const { t } = useTranslation();
    const { getJson } = useSecuredApi();

    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [channels, setChannels] = useState<Channel[]>([]);
    const [selectedPermissions, setSelectedPermissions] = useState<Set<string>>(new Set());

    // Base permissions
    const basePermissions = [
        {
            name: import.meta.env.READ_PERMISSION,
            description: t('read-permission-description'),
        },
        {
            name: import.meta.env.WRITE_PERMISSION,
            description: t('write-permission-description'),
        },
        {
            name: import.meta.env.ADMIN_PERMISSION,
            description: t('admin-permission-description'),
        },
        {
            name: import.meta.env.TENANT_ADMIN_PERMISSION,
            description: t('tenant-admin-permission-description'),
        },
    ];

    useEffect(() => {
        if (isOpen) {
            loadData();
        }
    }, [isOpen, user]);

    const loadData = async () => {
        setLoading(true);
        try {
            // Load channels for access permissions
            await loadChannels();

            // Initialize selected permissions from user's current permissions
            const currentPermissions = new Set(
                user.permissions?.map(p => p.permission_name) || []
            );
            setSelectedPermissions(currentPermissions);
        } catch (error) {
            console.error("Error loading data:", error);
        } finally {
            setLoading(false);
        }
    };

    const loadChannels = async () => {
        try {
            const response = await getJson(`${import.meta.env.API_BASE_URL}/v1/channels`) as APIResponse<ChannelsListResponse>;

            if (response.success && response.data) {
                setChannels(response.data.channels);
            }
        } catch (error) {
            console.error("Error loading channels:", error);
        }
    };

    const handlePermissionChange = (permissionName: string, isSelected: boolean) => {
        setSelectedPermissions(prev => {
            const newSet = new Set(prev);
            if (isSelected) {
                newSet.add(permissionName);
            } else {
                newSet.delete(permissionName);
            }
            return newSet;
        });
    };

    const savePermissions = async () => {
        setSaving(true);
        try {
            const currentPermissions = new Set(
                user.permissions?.map(p => p.permission_name) || []
            );

            // Find permissions to add and remove
            const permissionsToAdd = [...selectedPermissions].filter(
                perm => !currentPermissions.has(perm)
            );
            const permissionsToRemove = [...currentPermissions].filter(
                perm => !selectedPermissions.has(perm)
            );

            // Remove permissions
            if (permissionsToRemove.length > 0) {
                await removeUserPermissions(permissionsToRemove);
            }

            // Add permissions
            if (permissionsToAdd.length > 0) {
                await addUserPermissions(permissionsToAdd);
            }

            // Reload user permissions
            const updatedUser = await fetchUpdatedUserPermissions();
            onPermissionsUpdated(updatedUser);
            onClose();
        } catch (error) {
            console.error("Error saving permissions:", error);
        } finally {
            setSaving(false);
        }
    };

    const removeUserPermissions = async (permissions: string[]) => {
        const permissionsPayload = permissions.map(permissionName => ({
            resource_server_identifier: import.meta.env.AUTH0_AUDIENCE,
            permission_name: permissionName,
        }));

        const response = await fetch(
            `https://${import.meta.env.AUTH0_DOMAIN}/api/v2/users/${encodeURIComponent(user.user_id)}/permissions`,
            {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${managementToken}`,
                },
                body: JSON.stringify({
                    permissions: permissionsPayload,
                }),
            }
        );

        if (!response.ok) {
            throw new Error(`Failed to remove permissions: ${response.statusText}`);
        }
    };

    const addUserPermissions = async (permissions: string[]) => {
        const permissionsPayload = permissions.map(permissionName => ({
            resource_server_identifier: import.meta.env.AUTH0_AUDIENCE,
            permission_name: permissionName,
        }));

        const response = await fetch(
            `https://${import.meta.env.AUTH0_DOMAIN}/api/v2/users/${encodeURIComponent(user.user_id)}/permissions`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${managementToken}`,
                },
                body: JSON.stringify({
                    permissions: permissionsPayload,
                }),
            }
        );

        if (!response.ok) {
            throw new Error(`Failed to add permissions: ${response.statusText}`);
        }
    };

    const fetchUpdatedUserPermissions = async (): Promise<Auth0User> => {
        const response = await fetch(
            `https://${import.meta.env.AUTH0_DOMAIN}/api/v2/users/${encodeURIComponent(user.user_id)}/permissions`,
            {
                headers: {
                    'Authorization': `Bearer ${managementToken}`,
                    'Content-Type': 'application/json',
                },
            }
        );

        if (!response.ok) {
            throw new Error(`Failed to fetch updated permissions: ${response.statusText}`);
        }

        const permissions = await response.json();
        const filteredPermissions = permissions.filter((permission: Auth0Permission) =>
            permission.resource_server_identifier === import.meta.env.AUTH0_AUDIENCE
        );

        return {
            ...user,
            permissions: filteredPermissions,
        };
    };

    const getChannelPermissionName = (channelUuid: string) => {
        return `${import.meta.env.ACCESS_PERMISSION_PREFIX}:${channelUuid}`;
    };

    const isPermissionSelected = (permissionName: string) => {
        return selectedPermissions.has(permissionName);
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            size="2xl"
            scrollBehavior="inside"
        >
            <ModalContent>
                {(onClose) => (
                    <>
                        <ModalHeader className="flex flex-col gap-1">
                            <h3>{t('edit-user-permissions')}</h3>
                            <p className="text-sm text-default-500">
                                {user.name || user.email}
                            </p>
                        </ModalHeader>
                        <ModalBody>
                            {loading ? (
                                <div className="flex justify-center py-8">
                                    <Spinner size="lg" />
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    {/* Base Permissions */}
                                    <div>
                                        <h4 className="text-lg font-semibold mb-3">
                                            {t('base-permissions')}
                                        </h4>
                                        <div className="space-y-3">
                                            {basePermissions.map((permission) => (
                                                <Checkbox
                                                    key={permission.name}
                                                    isSelected={isPermissionSelected(permission.name)}
                                                    onValueChange={(isSelected) =>
                                                        handlePermissionChange(permission.name, isSelected)
                                                    }
                                                >
                                                    <div className="flex flex-col">
                                                        <span className="font-mono text-sm text-primary-600">
                                                            {permission.name}
                                                        </span>
                                                        <span className="text-xs text-default-500">
                                                            {permission.description}
                                                        </span>
                                                    </div>
                                                </Checkbox>
                                            ))}
                                        </div>
                                    </div>

                                    <Divider />

                                    {/* Channel Access Permissions */}
                                    <div>
                                        <h4 className="text-lg font-semibold mb-3">
                                            {t('channel-access-permissions')}
                                        </h4>
                                        {channels.length === 0 ? (
                                            <p className="text-sm text-default-400">
                                                {t('no-channels-available')}
                                            </p>
                                        ) : (
                                            <div className="space-y-3 max-h-60 overflow-y-auto">
                                                {channels.map((channel) => {
                                                    const permissionName = getChannelPermissionName(channel.uuid);
                                                    return (
                                                        <Checkbox
                                                            key={channel.uuid}
                                                            isSelected={isPermissionSelected(permissionName)}
                                                            onValueChange={(isSelected) =>
                                                                handlePermissionChange(permissionName, isSelected)
                                                            }
                                                        >
                                                            <div className="flex flex-col">
                                                                <div className="flex items-center gap-2">
                                                                    <span className="font-semibold text-sm">
                                                                        {channel.name}
                                                                    </span>
                                                                    <Chip size="sm" variant="flat" color="primary">
                                                                        {channel.type}
                                                                    </Chip>
                                                                </div>
                                                                <span className="font-mono text-xs text-primary-600">
                                                                    {permissionName}
                                                                </span>
                                                                {channel.description && (
                                                                    <span className="text-xs text-default-500">
                                                                        {channel.description}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </Checkbox>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </ModalBody>
                        <ModalFooter>
                            <Button
                                variant="light"
                                onPress={onClose}
                                isDisabled={saving}
                            >
                                {t('cancel')}
                            </Button>
                            <Button
                                color="primary"
                                onPress={savePermissions}
                                isLoading={saving}
                                isDisabled={loading}
                            >
                                {t('save-permissions')}
                            </Button>
                        </ModalFooter>
                    </>
                )}
            </ModalContent>
        </Modal>
    );
}
