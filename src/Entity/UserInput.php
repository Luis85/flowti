<?php

namespace App\Entity;

class UserInput
{

    protected string $text;

    public function __toString(): string
    {
        return $this->text;
    }

    public function setText(string $text): void
    {
        $this->text = $text;
    }

    public function getText(): string
    {
        return $this->text;
    }
}