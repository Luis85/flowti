<?php

namespace App\Entity;

class UserInput
{

    protected string $text;

    protected ?string $tags = null;

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

    public function setTags(?string $tags): void
    {
        $this->tags = $tags;
    }

    public function getTags(): array
    {
        $tags = [];
        if(isset($this->tags)){
            $tags = explode(",", $this->tags);
            $tags = array_map('trim', $tags);
        }
        return $tags;
    }
}