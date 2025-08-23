/**
 * @copyright Copyright (c) 2024-2025 Ronan LE MEILLAT
 * @license AGPL-3.0-or-later
 */

import { useState, useEffect } from "react";
import { Button } from "@heroui/button";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Input } from "@heroui/input";
import { Chip } from "@heroui/chip";
import { Spinner } from "@heroui/spinner";
import {
    Dropdown,
    DropdownTrigger,
    DropdownMenu,
    DropdownItem,
} from "@heroui/dropdown";
import {
    Table,
    TableHeader,
    TableColumn,
    TableBody,
    TableRow,
    TableCell,
} from "@heroui/table";

import DefaultLayout from "@/layouts/default";
import { title } from "@/components/primitives";
import { useSecuredApi } from "@/authentication";
import { SearchIcon } from "@/components/icons";
import EditPermissionsModal from "@/modals/edit-permissions";
import { Auth0ManagementTokenData } from "@/types/auth0-management";
import { APIResponse } from "@/types/ptt";
import { CopyButton } from "@/components/copy-button";
import { useTranslation } from "react-i18next";

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

interface Auth0UsersResponse {
    users: Auth0User[];
    total: number;
    page: number;
    per_page: number;
}

const USERS_PER_PAGE = 25;

export default function UsersAdminPage() {
    const { t, i18n } = useTranslation();
    const { hasPermission, getJson } = useSecuredApi();

    const [users, setUsers] = useState<Auth0User[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string>("");
    const [isAdminUser, setIsAdminUser] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [currentPage, setCurrentPage] = useState(0);
    const [totalUsers, setTotalUsers] = useState(0);
    const [refreshing, setRefreshing] = useState(false);
    const [managementToken, setManagementToken] = useState<string | null>(null);
    const [editPermissionsModalOpen, setEditPermissionsModalOpen] = useState(false);
    const [selectedUserForPermissions, setSelectedUserForPermissions] = useState<Auth0User | null>(null);

    /**
     * Fetch users from the Auth0 Management API.
     * @param page The page number to fetch.
     * @param search The search term to filter users.
     */
    const fetchUsers = async (page = 0, search = "") => {
        try {
            setError("");
            setRefreshing(page === currentPage);

            const params = new URLSearchParams({
                page: page.toString(),
                per_page: USERS_PER_PAGE.toString(),
            });

            if (search.trim()) {
                params.set('search', search.trim());
            }

            // Get Management API token using Auth0 SDK
            const managementToken = await getManagementApiToken();
            if (!managementToken) {
                throw new Error(t('unable-to-obtain-management-api-token'));
            } else {
                setManagementToken(managementToken);
            }

            const response = await fetchAuth0Users(managementToken, page, USERS_PER_PAGE, search);

            setUsers(response.users);
            setTotalUsers(response.total);
            setCurrentPage(page);
        } catch (err) {
            console.error("Error fetching users:", err);
            const errorMessage = err instanceof Error ? err.message : t('unknown-error');

            if (errorMessage.includes("authentication required") || errorMessage.includes("consent_required")) {
                setError(t('authentication-required-management-api'));
            } else {
                setError(errorMessage);
            }
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const getManagementApiToken = async (): Promise<string | null> => {
        try {
            const response = await getJson(`${import.meta.env.API_BASE_URL}/v1/auth0-management/token`) as APIResponse<Auth0ManagementTokenData>;

            console.log("Management API token response:", response);
            if (!response.success) {
                const errorData = response.error;
                throw new Error(errorData || `Backend API Error: ${response.error} `);
            }

            const data = response.data;

            if (data?.access_token) {
                console.log("Management API token obtained from backend:", data.cached ? "(cached)" : "(new)");
                return data.access_token;
            } else {
                throw new Error(t('invalid-response-format-backend'));
            }
        } catch (error) {
            console.error("Error obtaining Management API token from backend:", error);

            // If backend fails, provide helpful error message
            const errorMessage = error instanceof Error ? error.message : t('unknown-error');
            if (errorMessage.includes("403") || errorMessage.includes("Insufficient permissions")) {
                throw new Error(t('insufficient-permissions-tenant-admin'));
            } else if (errorMessage.includes("401") || errorMessage.includes("Authentication")) {
                throw new Error(t('authentication-required-login-again'));
            } else {
                throw new Error(t('failed-obtain-management-token', { error: errorMessage }));
            }
        }
    };

    const fetchUserPermissions = async (
        token: string,
        userId: string
    ): Promise<Auth0Permission[]> => {
        try {
            const response = await fetch(
                `https://${import.meta.env.AUTH0_DOMAIN}/api/v2/users/${encodeURIComponent(userId)}/permissions`,
                {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                }
            );

            if (!response.ok) {
                console.warn(`Failed to fetch permissions for user ${userId}:`, response.status, response.statusText);
                return [];
            }

            const permissions = await response.json();

            // Filter permissions by current audience (resource server identifier)
            return permissions.filter((permission: Auth0Permission) =>
                permission.resource_server_identifier === import.meta.env.AUTH0_AUDIENCE
            );
        } catch (error) {
            console.error(`Error fetching permissions for user ${userId}:`, error);
            return [];
        }
    };

    const fetchAuth0Users = async (
        token: string,
        page: number,
        perPage: number,
        search: string
    ): Promise<Auth0UsersResponse> => {
        try {
            // First, get all grants for our client ID and audience
            const grantsParams = new URLSearchParams({
                client_id: import.meta.env.AUTH0_CLIENT_ID,
                audience: import.meta.env.AUTH0_AUDIENCE,
            });

            const grantsResponse = await fetch(
                `https://${import.meta.env.AUTH0_DOMAIN}/api/v2/grants?${grantsParams.toString()}`,
                {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                }
            );

            if (!grantsResponse.ok) {
                throw new Error(t('auth0-grants-api-error', {
                    status: grantsResponse.status,
                    statusText: grantsResponse.statusText
                }));
            }

            const grants = await grantsResponse.json();

            // Extract unique user IDs from grants
            const userIds = [...new Set(grants.map((grant: any) => grant.user_id))];

            if (userIds.length === 0) {
                return {
                    users: [],
                    total: 0,
                    page,
                    per_page: perPage,
                };
            }

            // Now get user details for these user IDs
            let userQuery = userIds.map(id => `user_id:"${id}"`).join(' OR ');

            // Add search filter if provided
            if (search.trim()) {
                userQuery = `(${userQuery}) AND (email:"*${search}*" OR name:"*${search}*" OR nickname:"*${search}*")`;
            }

            const usersParams = new URLSearchParams({
                q: userQuery,
                page: page.toString(),
                per_page: perPage.toString(),
                include_totals: 'true',
            });

            const usersResponse = await fetch(
                `https://${import.meta.env.AUTH0_DOMAIN}/api/v2/users?${usersParams.toString()}`,
                {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                }
            );

            if (!usersResponse.ok) {
                throw new Error(t('auth0-users-api-error', {
                    status: usersResponse.status,
                    statusText: usersResponse.statusText
                }));
            }

            const usersData = await usersResponse.json();

            // Fetch permissions for each user
            const usersWithPermissions = await Promise.all(
                (usersData.users || []).map(async (user: Auth0User) => {
                    const permissions = await fetchUserPermissions(token, user.user_id);
                    return {
                        ...user,
                        permissions
                    };
                })
            );

            return {
                users: usersWithPermissions,
                total: usersData.total || 0,
                page,
                per_page: perPage,
            };

        } catch (error) {
            console.error('Error in fetchAuth0Users:', error);
            throw error;
        }
    };

    useEffect(() => {
        const initializeData = async () => {
            try {
                // Check tenant administration permissions
                const tenantAdminPermission = await hasPermission(import.meta.env.TENANT_ADMIN_PERMISSION);
                setIsAdminUser(tenantAdminPermission);

                if (!tenantAdminPermission) {
                    setError(t('insufficient-permissions-tenant-admin'));
                    setLoading(false);
                    return;
                }

                // Try to fetch users with Management API token
                await fetchUsers();
            } catch (err) {
                console.error("Initialization error:", err);
                setError(t('error-during-initialization'));
                setLoading(false);
            }
        };

        initializeData();
    }, []);

    const handleSearch = () => {
        setCurrentPage(0);
        fetchUsers(0, searchTerm);
    };

    const handleRefresh = () => {
        fetchUsers(currentPage, searchTerm);
    };

    const handlePageChange = (page: number) => {
        fetchUsers(page, searchTerm);
    };

    const formatDate = (dateString?: string) => {
        if (!dateString) return t('never');
        return new Date(dateString).toLocaleDateString(i18n.language, {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    const getConnectionType = (userId: string) => {
        if (userId.startsWith("google-oauth2|")) return t('google');
        if (userId.startsWith("auth0|")) return t('auth0');
        if (userId.startsWith("github|")) return t('github-connection');
        return t('other');
    };

    const getStatusColor = (user: Auth0User) => {
        if (user.blocked) return "danger";
        if (!user.email_verified) return "warning";
        return "success";
    };

    const getStatusText = (user: Auth0User) => {
        if (user.blocked) return t('blocked');
        if (!user.email_verified) return t('email-not-verified');
        return t('active');
    };

    const handleEditPermissions = (user: Auth0User) => {
        setSelectedUserForPermissions(user);
        setEditPermissionsModalOpen(true);
    };

    const handlePermissionsUpdated = (updatedUser: Auth0User) => {
        setUsers(prevUsers =>
            prevUsers.map(user =>
                user.user_id === updatedUser.user_id ? updatedUser : user
            )
        );
        setEditPermissionsModalOpen(false);
        setSelectedUserForPermissions(null);
    };

    const renderUserPermissions = (user: Auth0User) => {
        const hasPermissions = user.permissions && user.permissions.length > 0;

        return (
            <Dropdown>
                <DropdownTrigger>
                    <Button
                        variant="light"
                        size="sm"
                        className="h-auto p-2 min-w-0"
                    >
                        <div className="text-left">
                            <div className="text-xs text-default-500">
                                {hasPermissions
                                    ? t('permission-count', { count: user.permissions?.length || 0 })
                                    : t('no-user-permissions')
                                }
                            </div>
                        </div>
                    </Button>
                </DropdownTrigger>
                <DropdownMenu aria-label="User permissions">
                    {/* Permissions list */}
                    {hasPermissions ? (
                        <>
                            <DropdownItem
                                key="permissions-header"
                                className="cursor-default opacity-100"
                                textValue="permissions-list"
                            >
                                <div className="text-xs font-semibold text-default-600 mb-2">
                                    {t('current-permissions')}
                                </div>
                            </DropdownItem>
                            {(user.permissions ?? []).sort((a, b) =>
                                a.permission_name.localeCompare(b.permission_name)
                            ).map((permission, index) => (
                                <DropdownItem
                                    key={`permission-${index}`}
                                    className="cursor-default"
                                    textValue={permission.permission_name}
                                >
                                    <div className="flex flex-col gap-1 pl-2">
                                        <span className="font-mono text-xs text-primary-600">
                                            {permission.permission_name}
                                        </span>
                                        <span className="text-xs text-default-500">
                                            {permission.description}
                                        </span>
                                    </div>
                                </DropdownItem>
                            ))}
                            <DropdownItem
                                key="divider"
                                className="cursor-default opacity-100 border-t-1 border-default-200 mt-2"
                                textValue="divider"
                            >
                                <div></div>
                            </DropdownItem>
                        </>
                    ) : null}
                    {/* Edit permissions option */}
                    <DropdownItem
                        key="edit-permissions"
                        className="cursor-pointer"
                        textValue="edit-permissions"
                        onPress={() => handleEditPermissions(user)}
                    >
                        <div className="flex items-center gap-2">
                            <span className="text-sm">✏️</span>
                            <span className="text-sm font-medium">
                                {t('edit-permissions')}
                            </span>
                        </div>
                    </DropdownItem>
                </DropdownMenu>
            </Dropdown>
        );
    };

    if (!isAdminUser && !loading) {
        return (
            <DefaultLayout>
                <section className="flex flex-col items-center justify-center gap-4 py-8 md:py-10">
                    <div className="inline-block max-w-lg text-center justify-center">
                        <h1 className={title({ color: "pink" })}>{t('access-denied')}</h1>
                        <p className="text-lg mt-4">
                            {t('no-permissions-page')}
                        </p>
                    </div>
                </section>
            </DefaultLayout>
        );
    }

    return (
        <DefaultLayout>
            <section className="flex flex-col items-center justify-center gap-4 py-8 md:py-10">
                <div className="inline-block max-w-full text-center justify-center">

                    <h1 className={title({ color: "blue" })}>
                        👥 {t('auth0-users-administration')}<CopyButton value={managementToken || ""} title={t('copy-management-token-to-clipboard')} />
                    </h1>
                    <p className="text-lg mt-2 text-default-600">
                        {t('management-of-users-who-authorized-parawave-ptt')}
                    </p>
                </div>

                {error && (
                    <Card className="max-w-4xl w-full">
                        <CardBody>
                            <p className="text-danger text-center">{error}</p>
                        </CardBody>
                    </Card>
                )}

                <Card className="max-w-6xl w-full">
                    <CardHeader className="flex gap-3">
                        <div className="flex flex-col flex-1">
                            <p className="text-md font-semibold">{t('authorized-users')}</p>
                            <p className="text-small text-default-500">
                                {t('users-found', { count: totalUsers })}
                            </p>
                        </div>
                        <div className="flex gap-2">
                            <Input
                                placeholder={t('search-by-email-name')}
                                startContent={<SearchIcon className="w-4 h-4" />}
                                value={searchTerm}
                                onValueChange={setSearchTerm}
                                onKeyDown={(e: React.KeyboardEvent) => e.key === "Enter" && handleSearch()}
                                className="w-64"
                            />
                            <Button
                                color="primary"
                                variant="bordered"
                                onPress={handleSearch}
                                isDisabled={loading}
                            >
                                {t('search')}
                            </Button>
                            <Button
                                color="primary"
                                variant="light"
                                onPress={handleRefresh}
                                isDisabled={loading}
                                isLoading={refreshing}
                                startContent={!refreshing && <span>🔄</span>}
                            >
                                {t('refresh')}
                            </Button>
                        </div>
                    </CardHeader>

                    <CardBody>
                        {loading ? (
                            <div className="flex justify-center py-8">
                                <Spinner size="lg" />
                            </div>
                        ) : (
                            <Table aria-label="Auth0 users table">
                                <TableHeader>
                                    <TableColumn>{t('user-column')}</TableColumn>
                                    <TableColumn>{t('connection')}</TableColumn>
                                    <TableColumn>{t('status')}</TableColumn>
                                    <TableColumn>{t('permissions-column')}</TableColumn>
                                    <TableColumn>{t('logins')}</TableColumn>
                                    <TableColumn>{t('created')}</TableColumn>
                                    <TableColumn>{t('last-login')}</TableColumn>
                                </TableHeader>
                                <TableBody>
                                    {users.map((user) => (
                                        <TableRow key={user.user_id}>
                                            <TableCell>
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 font-semibold text-sm">
                                                        {(user.name || user.email).charAt(0).toUpperCase()}
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <p className="text-bold text-sm">
                                                            {user.name || user.nickname || t('unknown-name')}
                                                        </p>
                                                        <p className="text-bold text-sm text-default-400">
                                                            {user.email}
                                                        </p>
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Chip size="sm" variant="flat">
                                                    {getConnectionType(user.user_id)}
                                                </Chip>
                                            </TableCell>
                                            <TableCell>
                                                <Chip
                                                    color={getStatusColor(user)}
                                                    size="sm"
                                                    variant="flat"
                                                >
                                                    {getStatusText(user)}
                                                </Chip>
                                            </TableCell>
                                            <TableCell>
                                                {renderUserPermissions(user)}
                                            </TableCell>
                                            <TableCell>
                                                <span className="text-bold text-sm">
                                                    {user.logins_count}
                                                </span>
                                            </TableCell>
                                            <TableCell>
                                                <span className="text-sm">
                                                    {formatDate(user.created_at)}
                                                </span>
                                            </TableCell>
                                            <TableCell>
                                                <span className="text-sm">
                                                    {formatDate(user.last_login)}
                                                </span>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        )}

                        {!loading && totalUsers > USERS_PER_PAGE && (
                            <div className="flex justify-center mt-4 gap-2">
                                <Button
                                    size="sm"
                                    variant="bordered"
                                    onPress={() => handlePageChange(currentPage - 1)}
                                    isDisabled={currentPage === 0}
                                >
                                    {t('previous')}
                                </Button>
                                <span className="px-3 py-2 text-sm">
                                    {t('page-x-of-y', {
                                        current: currentPage + 1,
                                        total: Math.ceil(totalUsers / USERS_PER_PAGE)
                                    })}
                                </span>
                                <Button
                                    size="sm"
                                    variant="bordered"
                                    onPress={() => handlePageChange(currentPage + 1)}
                                    isDisabled={currentPage >= Math.ceil(totalUsers / USERS_PER_PAGE) - 1}
                                >
                                    {t('next')}
                                </Button>
                            </div>
                        )}
                    </CardBody>
                </Card>
            </section>

            {/* Edit Permissions Modal */}
            {selectedUserForPermissions && managementToken && (
                <EditPermissionsModal
                    isOpen={editPermissionsModalOpen}
                    onClose={() => {
                        setEditPermissionsModalOpen(false);
                        setSelectedUserForPermissions(null);
                    }}
                    user={selectedUserForPermissions}
                    managementToken={managementToken}
                    onPermissionsUpdated={handlePermissionsUpdated}
                />
            )}
        </DefaultLayout>
    );
}
