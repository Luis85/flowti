<?php

namespace App\Controller;

use App\Entity\Data;
use App\Entity\UserInput;
use App\Form\UserInputType;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Annotation\Route;

class HomeController extends AbstractController
{
    #[Route('/', name: 'app_home')]
    public function index(Request $request): Response
    {
        $userInput = new UserInput();

        $form = $this->createForm(UserInputType::class, $userInput);

        $form->handleRequest($request);
        if ($form->isSubmitted() && $form->isValid()) {
            // $form->getData() holds the submitted values
            // but, the original `$userInput` variable has also been updated
            // attention $userInput is now mixed
            $userInput = $form->getData();

            $data = new Data();
            $data->setTitle($userInput->__toString());
            $data->setType('UserInputText');
            $data->setCategory('UserInput');
            $data->setStatus('new');
            $data->setBody($userInput->getText());

            dump($userInput);
            dump($data);

            //return $this->redirectToRoute('app_home');
        }

        return $this->render('home/index.html.twig', [
            'controller_name' => 'HomeController',
            'form' => $form,
        ]);
    }
}
