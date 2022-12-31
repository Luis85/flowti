<?php

namespace App\Controller;

use App\Entity\Data;
use App\Entity\Tag;
use App\Entity\UserInput;
use App\Form\UserInputType;
use App\Repository\DataRepository;
use App\Repository\TagRepository;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Annotation\Route;

class HomeController extends AbstractController
{
    #[Route('/', name: 'app_home', methods: ['GET', 'POST'])]
    public function index(Request $request, DataRepository $dataRepository, TagRepository $tagRepository): Response
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
            $data->setType('Note');
            $data->setCategory('UserInput');
            $data->setStatus('new');

            foreach ($userInput->getTags() as $tagName) {
                $tag = $tagRepository->findOneBy(['name' => $tagName]);
                if($tag === null) {
                    $tag = new Tag();
                    $tag->setName($tagName);
                    $tagRepository->save($tag, true);
                }
                $data->addTag($tag);
            }

            $dataRepository->save($data, true);
            return $this->redirectToRoute('app_data_show',['id' => $data->getId()], Response::HTTP_SEE_OTHER);

        }

        return $this->render('home/index.html.twig', [
            'form' => $form,
        ]);
    }
}
