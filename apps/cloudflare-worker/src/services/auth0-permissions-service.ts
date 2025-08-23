/**
 * @copyright Copyright (c) 2024-2025 Ronan LE MEILLAT
 * @license MIT
 */

import { Auth0ManagementTokenService } from './auth0-management-token-service';

interface Auth0ResourceServer {
    id: string;
    name: string;
    identifier: string;
    scopes: Array<{
        value: string;
        description: string;
    }>;
}

/**
 * Service for managing Auth0 API resource server permissions (scopes)
 */
export class Auth0PermissionsService {
    private managementTokenService: Auth0ManagementTokenService;
    private env: Env;

    constructor(managementTokenService: Auth0ManagementTokenService, env: Env) {
        this.managementTokenService = managementTokenService;
        this.env = env;
    }

    /**
     * Get the current resource server configuration
     */
    private async getResourceServer(): Promise<{
        id: string;
        scopes: Array<{ value: string; description: string }>;
    } | null> {
        try {
            const token = await this.managementTokenService.getManagementToken();
            if (!token) {
                console.error('Failed to get management token for resource server fetch');
                return null;
            }

            const response = await fetch(
                `https://${this.env.AUTH0_DOMAIN}/api/v2/resource-servers/${encodeURIComponent(this.env.AUTH0_AUDIENCE)}`,
                {
                    method: 'GET',
                    headers: {
                        'Accept': 'application/json',
                        'Authorization': `Bearer ${token}`,
                    },
                }
            );

            if (!response.ok) {
                const errorText = await response.text();
                console.error('Failed to fetch resource server:', response.status, errorText);
                return null;
            }

            const resourceServer = await response.json() as Auth0ResourceServer;
            return {
                id: resourceServer.id,
                scopes: resourceServer.scopes || []
            };
        } catch (error) {
            console.error('Error fetching resource server:', error);
            return null;
        }
    }

    /**
     * Update the resource server scopes
     */
    private async updateResourceServerScopes(
        resourceServerId: string,
        scopes: Array<{ value: string; description: string }>
    ): Promise<boolean> {
        try {
            const token = await this.managementTokenService.getManagementToken();
            if (!token) {
                console.error('Failed to get management token for resource server update');
                return false;
            }

            const response = await fetch(
                `https://${this.env.AUTH0_DOMAIN}/api/v2/resource-servers/${resourceServerId}`,
                {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                        'Authorization': `Bearer ${token}`,
                    },
                    body: JSON.stringify({ scopes }),
                }
            );

            if (!response.ok) {
                const errorText = await response.text();
                console.error('Failed to update resource server scopes:', response.status, errorText);
                return false;
            }

            console.log(`Successfully updated resource server scopes`);
            return true;
        } catch (error) {
            console.error('Error updating resource server scopes:', error);
            return false;
        }
    }

    /**
     * Add a channel access permission
     */
    async addChannelPermission(channelUuid: string, channelName: string): Promise<boolean> {
        try {
            const resourceServer = await this.getResourceServer();
            if (!resourceServer) {
                return false;
            }

            const permissionValue = `${this.env.ACCESS_PERMISSION_PREFIX}:${channelUuid.toLowerCase()}`;
            const permissionDescription = `Access to channel ${channelName}`;

            // Check if permission already exists
            const existingPermission = resourceServer.scopes.find(scope => scope.value === permissionValue);
            if (existingPermission) {
                console.log(`Permission ${permissionValue} already exists`);
                return true;
            }

            // Add the new permission
            const updatedScopes = [
                ...resourceServer.scopes,
                {
                    value: permissionValue,
                    description: permissionDescription
                }
            ];

            const success = await this.updateResourceServerScopes(resourceServer.id, updatedScopes);
            if (success) {
                console.log(`Added channel permission: ${permissionValue}`);
            }

            return success;
        } catch (error) {
            console.error('Error adding channel permission:', error);
            return false;
        }
    }

    /**
     * Remove a channel access permission
     */
    async removeChannelPermission(channelUuid: string): Promise<boolean> {
        try {
            const resourceServer = await this.getResourceServer();
            if (!resourceServer) {
                return false;
            }

            const permissionValue = `${this.env.ACCESS_PERMISSION_PREFIX}:${channelUuid.toLowerCase()}`;

            // Filter out the permission to remove
            const updatedScopes = resourceServer.scopes.filter(scope => scope.value !== permissionValue);

            // Check if permission was actually removed
            if (updatedScopes.length === resourceServer.scopes.length) {
                console.log(`Permission ${permissionValue} not found, nothing to remove`);
                return true;
            }

            const success = await this.updateResourceServerScopes(resourceServer.id, updatedScopes);
            if (success) {
                console.log(`Removed channel permission: ${permissionValue}`);
            }

            return success;
        } catch (error) {
            console.error('Error removing channel permission:', error);
            return false;
        }
    }

    /**
     * Check if a channel permission exists
     */
    async hasChannelPermission(channelUuid: string): Promise<boolean> {
        try {
            const resourceServer = await this.getResourceServer();
            if (!resourceServer) {
                return false;
            }

            const permissionValue = `${this.env.ACCESS_PERMISSION_PREFIX}:${channelUuid.toUpperCase()}`;
            return resourceServer.scopes.some(scope => scope.value === permissionValue);
        } catch (error) {
            console.error('Error checking channel permission:', error);
            return false;
        }
    }

    /**
     * Get all channel permissions
     */
    async getChannelPermissions(): Promise<Array<{ uuid: string; description: string }>> {
        try {
            const resourceServer = await this.getResourceServer();
            if (!resourceServer) {
                return [];
            }

            return resourceServer.scopes
                .filter(scope => scope.value.startsWith(`${this.env.ACCESS_PERMISSION_PREFIX}:`))
                .map(scope => ({
                    uuid: scope.value.replace(`${this.env.ACCESS_PERMISSION_PREFIX}:`, ''),
                    description: scope.description
                }));
        } catch (error) {
            console.error('Error getting channel permissions:', error);
            return [];
        }
    }
}
