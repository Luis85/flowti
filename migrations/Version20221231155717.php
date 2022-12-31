<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Auto-generated Migration: Please modify to your needs!
 */
final class Version20221231155717 extends AbstractMigration
{
    public function getDescription(): string
    {
        return '';
    }

    public function up(Schema $schema): void
    {
        // this up() migration is auto-generated, please modify it to your needs
        $this->addSql('CREATE TABLE data_tag (data_id INT NOT NULL, tag_id INT NOT NULL, PRIMARY KEY(data_id, tag_id))');
        $this->addSql('CREATE INDEX IDX_4705563637F5A13C ON data_tag (data_id)');
        $this->addSql('CREATE INDEX IDX_47055636BAD26311 ON data_tag (tag_id)');
        $this->addSql('ALTER TABLE data_tag ADD CONSTRAINT FK_4705563637F5A13C FOREIGN KEY (data_id) REFERENCES data (id) ON DELETE CASCADE NOT DEFERRABLE INITIALLY IMMEDIATE');
        $this->addSql('ALTER TABLE data_tag ADD CONSTRAINT FK_47055636BAD26311 FOREIGN KEY (tag_id) REFERENCES tag (id) ON DELETE CASCADE NOT DEFERRABLE INITIALLY IMMEDIATE');
    }

    public function down(Schema $schema): void
    {
        // this down() migration is auto-generated, please modify it to your needs
        $this->addSql('CREATE SCHEMA public');
        $this->addSql('ALTER TABLE data_tag DROP CONSTRAINT FK_4705563637F5A13C');
        $this->addSql('ALTER TABLE data_tag DROP CONSTRAINT FK_47055636BAD26311');
        $this->addSql('DROP TABLE data_tag');
    }
}
