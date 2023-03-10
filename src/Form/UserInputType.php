<?php

namespace App\Form;

use App\Entity\UserInput;
use Symfony\Component\Form\AbstractType;
use Symfony\Component\Form\Extension\Core\Type\SubmitType;
use Symfony\Component\Form\Extension\Core\Type\TextType;
use Symfony\Component\Form\FormBuilderInterface;
use Symfony\Component\OptionsResolver\OptionsResolver;

class UserInputType extends AbstractType
{
    public function buildForm(FormBuilderInterface $builder, array $options): void
    {
        $builder
            ->add('text', TextType::class, ['label' => 'common.question.what.todo'])
            ->add('tags', TextType::class, ['label' => 'common.field.tags', 'required' => false])
            ->add('save', SubmitType::class, ['label' => 'common.save'])
        ;
    }

    public function configureOptions(OptionsResolver $resolver): void
    {
        $resolver->setDefaults([
            'data_class' => UserInput::class,
        ]);
    }
}
