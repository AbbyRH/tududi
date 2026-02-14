'use strict';

const { safeAddIndex } = require('../utils/migration-utils');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        const tableName = 'oidc_user_links';
        let tableExists = false;
        try {
            await queryInterface.describeTable(tableName);
            tableExists = true;
        } catch (error) {
            tableExists = false;
        }

        if (!tableExists) {
            await queryInterface.createTable(tableName, {
                id: {
                    type: Sequelize.INTEGER,
                    primaryKey: true,
                    autoIncrement: true,
                },
                user_id: {
                    type: Sequelize.INTEGER,
                    allowNull: false,
                    references: {
                        model: 'users',
                        key: 'id',
                    },
                    onDelete: 'CASCADE',
                },
                provider: {
                    type: Sequelize.STRING,
                    allowNull: false,
                    comment: 'OIDC provider name (e.g., keycloak)',
                },
                provider_user_id: {
                    type: Sequelize.STRING,
                    allowNull: false,
                    comment: 'User ID from OIDC provider (subject claim)',
                },
                issuer: {
                    type: Sequelize.STRING,
                    allowNull: false,
                    comment: 'OIDC issuer URL',
                },
                created_at: {
                    type: Sequelize.DATE,
                    allowNull: false,
                    defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
                },
                updated_at: {
                    type: Sequelize.DATE,
                    allowNull: false,
                    defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
                },
            });
        }

        // Add unique constraint on provider identity
        await safeAddIndex(
            queryInterface,
            tableName,
            ['provider', 'provider_user_id', 'issuer'],
            {
                name: 'oidc_user_links_provider_unique',
                unique: true,
            }
        );

        // Add index on user_id for lookups
        await safeAddIndex(queryInterface, tableName, ['user_id'], {
            name: 'oidc_user_links_user_id_idx',
        });
    },

    async down(queryInterface) {
        await queryInterface.dropTable('oidc_user_links');
    },
};
