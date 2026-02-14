const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const OidcUserLink = sequelize.define(
        'OidcUserLink',
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            user_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: {
                    model: 'users',
                    key: 'id',
                },
                field: 'user_id',
            },
            provider: {
                type: DataTypes.STRING,
                allowNull: false,
                comment: 'OIDC provider name (e.g., keycloak)',
            },
            provider_user_id: {
                type: DataTypes.STRING,
                allowNull: false,
                field: 'provider_user_id',
                comment: 'User ID from OIDC provider (subject claim)',
            },
            issuer: {
                type: DataTypes.STRING,
                allowNull: false,
                comment: 'OIDC issuer URL',
            },
        },
        {
            tableName: 'oidc_user_links',
            underscored: true,
            indexes: [
                {
                    unique: true,
                    fields: ['provider', 'provider_user_id', 'issuer'],
                    name: 'oidc_user_links_provider_unique',
                },
                {
                    fields: ['user_id'],
                    name: 'oidc_user_links_user_id_idx',
                },
            ],
        }
    );

    OidcUserLink.associate = (models) => {
        OidcUserLink.belongsTo(models.User, {
            foreignKey: 'user_id',
            onDelete: 'CASCADE',
        });
    };

    return OidcUserLink;
};
