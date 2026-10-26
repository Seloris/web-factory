using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RosterComp.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddRosterBuilder : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Players",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    Pseudo = table.Column<string>(type: "TEXT", maxLength: 24, nullable: false),
                    PseudoKey = table.Column<string>(type: "TEXT", maxLength: 24, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Players", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Rosters",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    RaidId = table.Column<string>(type: "TEXT", maxLength: 40, nullable: false),
                    Tanks = table.Column<int>(type: "INTEGER", nullable: false),
                    Heals = table.Column<int>(type: "INTEGER", nullable: false),
                    IsGenerated = table.Column<bool>(type: "INTEGER", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Rosters", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "PlayerChoices",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    Position = table.Column<int>(type: "INTEGER", nullable: false),
                    SpecId = table.Column<string>(type: "TEXT", maxLength: 40, nullable: false),
                    Rank = table.Column<string>(type: "TEXT", maxLength: 1, nullable: false),
                    PlayerId = table.Column<int>(type: "INTEGER", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PlayerChoices", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PlayerChoices_Players_PlayerId",
                        column: x => x.PlayerId,
                        principalTable: "Players",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "RosterPlacements",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    PlayerId = table.Column<int>(type: "INTEGER", nullable: false),
                    SpecId = table.Column<string>(type: "TEXT", maxLength: 40, nullable: false),
                    IsLocked = table.Column<bool>(type: "INTEGER", nullable: false),
                    RosterId = table.Column<int>(type: "INTEGER", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RosterPlacements", x => x.Id);
                    table.ForeignKey(
                        name: "FK_RosterPlacements_Players_PlayerId",
                        column: x => x.PlayerId,
                        principalTable: "Players",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_RosterPlacements_Rosters_RosterId",
                        column: x => x.RosterId,
                        principalTable: "Rosters",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_PlayerChoices_PlayerId",
                table: "PlayerChoices",
                column: "PlayerId");

            migrationBuilder.CreateIndex(
                name: "IX_Players_PseudoKey",
                table: "Players",
                column: "PseudoKey",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_RosterPlacements_PlayerId",
                table: "RosterPlacements",
                column: "PlayerId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_RosterPlacements_RosterId",
                table: "RosterPlacements",
                column: "RosterId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "PlayerChoices");

            migrationBuilder.DropTable(
                name: "RosterPlacements");

            migrationBuilder.DropTable(
                name: "Players");

            migrationBuilder.DropTable(
                name: "Rosters");
        }
    }
}
