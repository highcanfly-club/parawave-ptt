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
    Table,
    TableHeader,
    TableColumn,
    TableBody,
    TableRow,
    TableCell,
} from "@heroui/table";
import { useAuth0 } from "@auth0/auth0-react";

import DefaultLayout from "@/layouts/default";
import { title } from "@/components/primitives";
import { useSecuredApi } from "@/authentication";
import { SearchIcon } from "@/components/icons";
import { Auth0ManagementTokenData, Auth0ManagementTokenResponse } from "@/types/auth0-management";
import { APIResponse } from "@/types/ptt";

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
}

interface Auth0UsersResponse {
    users: Auth0User[];
    total: number;
    page: number;
    per_page: number;
}

const USERS_PER_PAGE = 25;

export default function UsersAdminPage() {
    const { hasPermission, getJson } = useSecuredApi();

    const [users, setUsers] = useState<Auth0User[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string>("");
    const [isAdminUser, setIsAdminUser] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [currentPage, setCurrentPage] = useState(0);
    const [totalUsers, setTotalUsers] = useState(0);
    const [refreshing, setRefreshing] = useState(false);

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
                throw new Error("Unable to obtain Management API token - authentication required");
            }

            const response = await fetchAuth0Users(managementToken, page, USERS_PER_PAGE, search);

            setUsers(response.users);
            setTotalUsers(response.total);
            setCurrentPage(page);
        } catch (err) {
            console.error("Error fetching users:", err);
            const errorMessage = err instanceof Error ? err.message : "Unknown error";

            if (errorMessage.includes("authentication required") || errorMessage.includes("consent_required")) {
                setError("Authentication required for Management API access. You may need to re-authenticate.");
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
                throw new Error("Invalid response format from backend");
            }
        } catch (error) {
            console.error("Error obtaining Management API token from backend:", error);

            // If backend fails, provide helpful error message
            const errorMessage = error instanceof Error ? error.message : "Unknown error";
            if (errorMessage.includes("403") || errorMessage.includes("Insufficient permissions")) {
                throw new Error("Insufficient permissions - tenant administration required");
            } else if (errorMessage.includes("401") || errorMessage.includes("Authentication")) {
                throw new Error("Authentication required - please log in again");
            } else {
                throw new Error(`Failed to obtain Management API token: ${errorMessage}`);
            }
        }
    };

    const fetchAuth0Users = async (
        token: string,
        page: number,
        perPage: number,
        search: string
    ): Promise<Auth0UsersResponse> => {
        const params = new URLSearchParams({
            page: page.toString(),
            per_page: perPage.toString(),
            include_totals: 'true',
        });

        // Filter users who have authorized our application
        let query = `app_metadata.authorized_apps:"${import.meta.env.AUTH0_CLIENT_ID}"`;

        if (search.trim()) {
            query += ` AND (email:"*${search}*" OR name:"*${search}*" OR nickname:"*${search}*")`;
        }

        params.set('q', query);

        const response = await fetch(
            `https://${import.meta.env.AUTH0_DOMAIN}/api/v2/users?${params.toString()}`,
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            }
        );

        if (!response.ok) {
            throw new Error(`Auth0 API Error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        return {
            users: data.users || [],
            total: data.total || 0,
            page,
            per_page: perPage,
        };
    };

    useEffect(() => {
        const initializeData = async () => {
            try {
                // Check tenant administration permissions
                const tenantAdminPermission = await hasPermission(import.meta.env.TENANT_ADMIN_PERMISSION);
                setIsAdminUser(tenantAdminPermission);

                if (!tenantAdminPermission) {
                    setError("Insufficient permissions - tenant administration required");
                    setLoading(false);
                    return;
                }

                // Try to fetch users with Management API token
                await fetchUsers();
            } catch (err) {
                console.error("Initialization error:", err);
                setError("Error during initialization - you may need to re-authenticate");
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
        if (!dateString) return "Never";
        return new Date(dateString).toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    const getConnectionType = (userId: string) => {
        if (userId.startsWith("google-oauth2|")) return "Google";
        if (userId.startsWith("auth0|")) return "Auth0";
        if (userId.startsWith("github|")) return "GitHub";
        return "Other";
    };

    const getStatusColor = (user: Auth0User) => {
        if (user.blocked) return "danger";
        if (!user.email_verified) return "warning";
        return "success";
    };

    const getStatusText = (user: Auth0User) => {
        if (user.blocked) return "Blocked";
        if (!user.email_verified) return "Email not verified";
        return "Active";
    };

    if (!isAdminUser && !loading) {
        return (
            <DefaultLayout>
                <section className="flex flex-col items-center justify-center gap-4 py-8 md:py-10">
                    <div className="inline-block max-w-lg text-center justify-center">
                        <h1 className={title({ color: "pink" })}>Access Denied</h1>
                        <p className="text-lg mt-4">
                            You don't have the necessary permissions to access this page.
                            Tenant administration is required.
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
                        👥 Auth0 Users Administration
                    </h1>
                    <p className="text-lg mt-2 text-default-600">
                        Management of users who have authorized the Parawave PTT application
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
                            <p className="text-md font-semibold">Authorized users</p>
                            <p className="text-small text-default-500">
                                {totalUsers} user{totalUsers !== 1 ? "s" : ""} found
                            </p>
                        </div>
                        <div className="flex gap-2">
                            <Input
                                placeholder="Search by email, name..."
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
                                Search
                            </Button>
                            <Button
                                color="primary"
                                variant="light"
                                onPress={handleRefresh}
                                isDisabled={loading}
                                isLoading={refreshing}
                                startContent={!refreshing && <span>🔄</span>}
                            >
                                Refresh
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
                                    <TableColumn>USER</TableColumn>
                                    <TableColumn>CONNECTION</TableColumn>
                                    <TableColumn>STATUS</TableColumn>
                                    <TableColumn>LOGINS</TableColumn>
                                    <TableColumn>CREATED</TableColumn>
                                    <TableColumn>LAST LOGIN</TableColumn>
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
                                                            {user.name || user.nickname || "Unknown name"}
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
                                    Previous
                                </Button>
                                <span className="px-3 py-2 text-sm">
                                    Page {currentPage + 1} of {Math.ceil(totalUsers / USERS_PER_PAGE)}
                                </span>
                                <Button
                                    size="sm"
                                    variant="bordered"
                                    onPress={() => handlePageChange(currentPage + 1)}
                                    isDisabled={currentPage >= Math.ceil(totalUsers / USERS_PER_PAGE) - 1}
                                >
                                    Next
                                </Button>
                            </div>
                        )}
                    </CardBody>
                </Card>
            </section>
        </DefaultLayout>
    );
}
